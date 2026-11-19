// Plip Overlay: Plip floating above every window on your Mac.
//
// The plip-pet plugin writes what Plip feels to ~/.plip (see hooks/overlay.ts);
// this app reads it twice a second and draws the plugin's own animated SVG in a
// small transparent panel. Drag Plip anywhere, click to open Claude,
// Option-click to pet, right-click for options. Built and installed by overlay/install.sh.

import AppKit
import WebKit

let plipDir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".plip")
let sessionsDir = plipDir.appendingPathComponent("sessions")
let spritesDir = plipDir.appendingPathComponent("sprites")
let inboxDir = plipDir.appendingPathComponent("inbox")

/// Plip's width in points for each size the right-click menu offers.
let sizes: [(name: String, width: CGFloat)] = [("Tiny", 48), ("Small", 72), ("Medium", 104), ("Large", 150)]
let defaultWidth: CGFloat = 72

/// Just room for Plip (its art is 40 x 44) and a little shadow.
func panelFrameSize(for width: CGFloat) -> NSSize {
    NSSize(width: width + 16, height: (width * 1.1 + 16).rounded())
}
let freshFor: TimeInterval = 90       // a session writes at least every 30 s
let forgetAfter: TimeInterval = 86_400 // a crashed session's file is cleared after a day
/// A pet from the menu, where the pointer isn't on Plip, shows hearts this long.
let lovedFor: TimeInterval = 1.5
/// Hearts show for as long as the pointer is on Plip, but a pet counts once
/// per visit: a pointer that wobbles out and back in within this long is the
/// same visit.
let hoverPetCooldown: TimeInterval = 5
/// Plip appearing under a resting pointer at login isn't a pet.
let launchGrace: TimeInterval = 2
let claudeBundleID = "com.anthropic.claudefordesktop"
let musicBundleID = "com.apple.Music"
/// While the music plays, Plip switches to another dance this often.
let danceEvery: ClosedRange<TimeInterval> = 10...15
/// Apple Music announces every play, pause and stop on these (the second is
/// the name it kept from iTunes); listening needs no permission.
let musicNotifications = ["com.apple.Music.playerInfo", "com.apple.iTunes.playerInfo"]

struct SessionState: Decodable {
    let mood: String
    let updatedAt: Double // ms since the epoch
}

// MARK: - reading the plugin's state

func readSessions(now: Date) -> [SessionState] {
    let fm = FileManager.default
    guard let names = try? fm.contentsOfDirectory(atPath: sessionsDir.path) else { return [] }
    var fresh: [SessionState] = []
    for name in names where name.hasSuffix(".json") {
        let url = sessionsDir.appendingPathComponent(name)
        guard let data = try? Data(contentsOf: url),
              let s = try? JSONDecoder().decode(SessionState.self, from: data) else { continue }
        let age = now.timeIntervalSince1970 - s.updatedAt / 1000
        if age > forgetAfter { try? fm.removeItem(at: url); continue }
        if age <= freshFor { fresh.append(s) }
    }
    return fresh
}

/// One Plip for every open session: a fresh reaction (happy, sad, loved) wins,
/// then any session at work, then whatever the latest session feels.
func combine(_ sessions: [SessionState]) -> String {
    guard let latest = sessions.max(by: { $0.updatedAt < $1.updatedAt }) else { return "sleepy" }
    if ["happy", "sad", "loved"].contains(latest.mood) { return latest.mood }
    if sessions.contains(where: { $0.mood == "working" }) { return "working" }
    return latest.mood
}

func sprite(_ mood: String) -> String? {
    try? String(contentsOf: spritesDir.appendingPathComponent("\(mood).svg"), encoding: .utf8)
}

func jsString(_ s: String) -> String {
    let data = try! JSONSerialization.data(withJSONObject: [s], options: [])
    return String(String(data: data, encoding: .utf8)!.dropFirst().dropLast())
}

// MARK: - the page Plip is drawn in

let page = """
<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; height: 100%; background: transparent; overflow: hidden;
    -webkit-user-select: none; cursor: grab; }
  #plip { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: 6px; }
  #plip svg { width: var(--w, 72px); height: auto; display: block; filter: drop-shadow(0 2px 3px rgba(0,0,0,.18)); }
  #plip .none { font-size: calc(var(--w, 72px) * .8); line-height: 1; }
</style></head><body><div id="plip"></div><script>
  function size(w) { document.documentElement.style.setProperty('--w', w + 'px') }
  function draw(svg) { document.getElementById('plip').innerHTML = svg || '<div class="none">💧</div>' }
</script></body></html>
"""

// MARK: - the panel

/// Sits over the web view and takes every mouse event: hover to pet, drag to
/// move, click to open Claude, Option-click to pet, right-click for the menu.
final class Handle: NSView {
    var onClick: () -> Void = {}
    var onPet: () -> Void = {}
    var onMoved: () -> Void = {}
    var onHover: (Bool) -> Void = { _ in }
    var makeMenu: () -> NSMenu = { NSMenu() }
    private var downAt: NSPoint?
    private var origin: NSPoint = .zero
    private var didDrag = false

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        trackingAreas.forEach(removeTrackingArea)
        addTrackingArea(NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self))
    }

    override func mouseEntered(with event: NSEvent) { onHover(true) }
    override func mouseExited(with event: NSEvent) { onHover(false) }

    override func mouseDown(with event: NSEvent) {
        downAt = NSEvent.mouseLocation
        origin = window?.frame.origin ?? .zero
        didDrag = false
        NSCursor.closedHand.push()
    }

    override func mouseDragged(with event: NSEvent) {
        guard let start = downAt, let window else { return }
        let now = NSEvent.mouseLocation
        let dx = now.x - start.x, dy = now.y - start.y
        if !didDrag && hypot(dx, dy) < 3 { return }
        didDrag = true
        window.setFrameOrigin(NSPoint(x: origin.x + dx, y: origin.y + dy))
    }

    override func mouseUp(with event: NSEvent) {
        NSCursor.pop()
        if didDrag { onMoved() }
        else if event.modifierFlags.contains(.option) { onPet() }
        else { onClick() }
        downAt = nil
    }

    override func rightMouseDown(with event: NSEvent) {
        NSMenu.popUpContextMenu(makeMenu(), with: event, for: self)
    }
}

final class Overlay: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    var plipWidth: CGFloat = {
        let saved = UserDefaults.standard.double(forKey: "width")
        return saved > 0 ? saved : defaultWidth
    }()
    var panelSize: NSSize { panelFrameSize(for: plipWidth) }

    lazy var panel = NSPanel(contentRect: NSRect(origin: .zero, size: panelSize),
                        styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    lazy var web = WKWebView(frame: NSRect(origin: .zero, size: panelSize))
    lazy var handle = Handle(frame: NSRect(origin: .zero, size: panelSize))
    var isReady = false
    var drawnMood: String?
    var lovedUntil = Date.distantPast
    var nextHoverPetAt = Date().addingTimeInterval(launchGrace)
    var isMusicPlaying = false
    var dance = 0
    var nextDanceAt = Date.distantPast
    var isVibeOn: Bool {
        get { UserDefaults.standard.object(forKey: "vibe") as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: "vibe") }
    }
    var timer: Timer?

    func applicationDidFinishLaunching(_ note: Notification) {
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
        panel.hidesOnDeactivate = false
        panel.isMovable = false

        web.setValue(false, forKey: "drawsBackground")
        web.navigationDelegate = self
        web.loadHTMLString(page, baseURL: nil)

        handle.onClick = { [weak self] in self?.openClaude() }
        handle.onPet = { [weak self] in self?.pet() }
        handle.onMoved = { [weak self] in self?.savePosition() }
        handle.onHover = { [weak self] isOver in
            if isOver { self?.hoverPet() }
            self?.tick()
        }
        handle.makeMenu = { [weak self] in self?.menu() ?? NSMenu() }

        let root = NSView(frame: NSRect(origin: .zero, size: panelSize))
        web.autoresizingMask = [.width, .height]
        handle.autoresizingMask = [.width, .height]
        root.addSubview(web)
        root.addSubview(handle)
        panel.contentView = root
        panel.setFrameOrigin(restoredPosition())
        panel.orderFrontRegardless()

        NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification,
                                               object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            if !self.isOnScreen(self.panel.frame.origin) { self.panel.setFrameOrigin(self.defaultPosition()) }
        }

        listenForMusic()
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in self?.tick() }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isReady = true
        web.evaluateJavaScript("size(\(Int(plipWidth)))")
        tick()
        // For checking the art: `--vibe` dances, `--dance <n>` holds one dance.
        if let i = args.firstIndex(of: "--dance"), args.indices.contains(i + 1), let n = Int(args[i + 1]) {
            dance = n
            nextDanceAt = .distantFuture
        }
        if args.contains("--vibe") { isMusicPlaying = true; tick() }
        if let out = snapshotPath { snapshot(to: out) }
        if args.contains("--open-claude") {  // what a click does, for checking it
            openClaude()
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) { exit(0) }
        }
    }

    /// `--snapshot <file.png>`: draws Plip once, saves it and quits (for checking the art).
    func snapshot(to path: String) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            self.web.takeSnapshot(with: nil) { image, _ in
                if let tiff = image?.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
                   let png = rep.representation(using: .png, properties: [:]) {
                    try? png.write(to: URL(fileURLWithPath: path))
                }
                exit(0)
            }
        }
    }

    // MARK: state

    func tick() {
        guard isReady else { return }
        let now = Date()
        // Asked of the pointer itself, so a missed exit (say, behind a menu)
        // can't leave Plip stuck with heart eyes.
        let isHovered = NSMouseInRect(NSEvent.mouseLocation, panel.frame, false)
        let fromClaude = combine(readSessions(now: now))
        // Hearts beat everything; then a fresh happy or sad from Claude; then
        // the disco while Apple Music plays; then whatever Claude is doing.
        let isDancing = isMusicPlaying && isVibeOn && !["happy", "sad"].contains(fromClaude)
        let mood = isHovered || now < lovedUntil ? "loved" : isDancing ? "vibing" : fromClaude
        let art = mood == "vibing" ? currentDance(now: now) : mood
        guard art != drawnMood else { return }
        drawnMood = art
        web.evaluateJavaScript("draw(\(jsString(sprite(art) ?? sprite(mood) ?? "")))")
    }

    /// The dance to show now, switching to a different one, at random, every
    /// 10 to 15 seconds. The plugin draws them as vibing-0.svg, vibing-1.svg, …
    func currentDance(now: Date) -> String {
        if now >= nextDanceAt {
            let count = danceCount()
            if count > 1 {
                let next = Int.random(in: 0..<(count - 1))
                dance = next >= dance ? next + 1 : next // never the same one twice running
            }
            nextDanceAt = now.addingTimeInterval(.random(in: danceEvery))
        }
        return "vibing-\(dance)"
    }

    func danceCount() -> Int {
        var n = 0
        while FileManager.default.fileExists(atPath: spritesDir.appendingPathComponent("vibing-\(n).svg").path) { n += 1 }
        return n
    }

    /// Plip dances while Apple Music plays. Music says so on every play, pause
    /// and stop; quitting it stops the music too. Music already playing when
    /// Plip starts is picked up at its next play, pause or track change.
    func listenForMusic() {
        for name in musicNotifications {
            DistributedNotificationCenter.default().addObserver(
                forName: NSNotification.Name(name), object: nil, queue: .main
            ) { [weak self] note in
                self?.isMusicPlaying = (note.userInfo?["Player State"] as? String) == "Playing"
                self?.tick()
            }
        }
        NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didTerminateApplicationNotification, object: nil, queue: .main
        ) { [weak self] note in
            let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
            guard app?.bundleIdentifier == musicBundleID else { return }
            self?.isMusicPlaying = false
            self?.tick()
        }
    }

    /// The pointer arriving over Plip is a pet, once per visit.
    func hoverPet() {
        guard Date() >= nextHoverPetAt else { return }
        nextHoverPetAt = Date().addingTimeInterval(hoverPetCooldown)
        pet()
    }

    func pet() {
        let fm = FileManager.default
        try? fm.createDirectory(at: inboxDir, withIntermediateDirectories: true)
        let file = inboxDir.appendingPathComponent("pet-\(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString)")
        fm.createFile(atPath: file.path, contents: Data())
        tick()
    }

    /// Brings the Claude desktop app to the front: launches it when it's closed,
    /// and reopens its window when it's running with none open.
    func openClaude() {
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: claudeBundleID) else {
            NSSound.beep()
            return
        }
        // Plip's panel never takes focus, so take it for this click and hand
        // it straight to Claude; otherwise macOS may open Claude behind.
        if #available(macOS 14.0, *) {
            NSApp.activate()
            NSApp.yieldActivation(toApplicationWithBundleIdentifier: claudeBundleID)
        } else {
            NSApp.activate(ignoringOtherApps: true)
        }
        let config = NSWorkspace.OpenConfiguration()
        config.activates = true
        NSWorkspace.shared.openApplication(at: url, configuration: config) { _, error in
            guard error != nil else { return }
            DispatchQueue.main.async { NSSound.beep() }
        }
    }

    // MARK: position

    func defaultPosition() -> NSPoint {
        let f = (NSScreen.main ?? NSScreen.screens[0]).visibleFrame
        return NSPoint(x: f.maxX - panelSize.width - 24, y: f.minY + 24)
    }

    func isOnScreen(_ p: NSPoint) -> Bool {
        let r = NSRect(origin: p, size: panelSize).insetBy(dx: 40, dy: 40)
        return NSScreen.screens.contains { $0.frame.intersects(r) }
    }

    func restoredPosition() -> NSPoint {
        let d = UserDefaults.standard
        guard d.object(forKey: "x") != nil else { return defaultPosition() }
        let p = NSPoint(x: d.double(forKey: "x"), y: d.double(forKey: "y"))
        return isOnScreen(p) ? p : defaultPosition()
    }

    func savePosition() {
        UserDefaults.standard.set(panel.frame.origin.x, forKey: "x")
        UserDefaults.standard.set(panel.frame.origin.y, forKey: "y")
    }

    // MARK: menu

    func menu() -> NSMenu {
        let m = NSMenu()
        m.addItem(withTitle: "Open Claude", action: #selector(openFromMenu), keyEquivalent: "").target = self
        m.addItem(withTitle: "Pet Plip ♥  (or Option-click)", action: #selector(petFromMenu), keyEquivalent: "").target = self
        let sizeItem = NSMenuItem(title: "Size", action: nil, keyEquivalent: "")
        let sizeMenu = NSMenu()
        for (i, size) in sizes.enumerated() {
            let item = sizeMenu.addItem(withTitle: size.name, action: #selector(setSize(_:)), keyEquivalent: "")
            item.target = self
            item.tag = i
            item.state = size.width == plipWidth ? .on : .off
        }
        sizeItem.submenu = sizeMenu
        m.addItem(sizeItem)
        let vibe = m.addItem(withTitle: "Dance to Apple Music", action: #selector(toggleVibe), keyEquivalent: "")
        vibe.target = self
        vibe.state = isVibeOn ? .on : .off
        m.addItem(withTitle: "Move Plip Back to the Corner", action: #selector(resetPosition), keyEquivalent: "").target = self
        m.addItem(.separator())
        m.addItem(withTitle: "Hide Until Next Login", action: #selector(quit), keyEquivalent: "").target = self
        m.addItem(withTitle: "Turn Off Overlay", action: #selector(turnOff), keyEquivalent: "").target = self
        return m
    }

    @objc func petFromMenu() {
        lovedUntil = Date().addingTimeInterval(lovedFor)
        pet()
    }
    @objc func openFromMenu() { openClaude() }
    @objc func toggleVibe() {
        isVibeOn.toggle()
        tick()
    }

    /// Grows or shrinks Plip around the bottom-right corner, so it stays put.
    @objc func setSize(_ item: NSMenuItem) {
        plipWidth = sizes[item.tag].width
        UserDefaults.standard.set(Double(plipWidth), forKey: "width")
        let old = panel.frame
        let new = panelSize
        panel.setFrame(NSRect(x: old.maxX - new.width, y: old.minY, width: new.width, height: new.height), display: true)
        web.evaluateJavaScript("size(\(Int(plipWidth)))")
        if UserDefaults.standard.object(forKey: "x") != nil { savePosition() }
    }

    @objc func resetPosition() {
        panel.setFrameOrigin(defaultPosition())
        UserDefaults.standard.removeObject(forKey: "x")
        UserDefaults.standard.removeObject(forKey: "y")
    }

    // A clean exit: launchd leaves Plip closed until the next login.
    @objc func quit() { NSApp.terminate(nil) }

    /// Off for good: no start at login, and the plugin puts Plip back in the
    /// Claude app's corner. `/plip overlay on`, or opening Plip Overlay
    /// yourself, turns it back on.
    @objc func turnOff() {
        FileManager.default.createFile(atPath: disabledMarker.path, contents: Data())
        launchctl("disable", "gui/\(getuid())/\(serviceLabel)")
        NSApp.terminate(nil)
    }
}

let serviceLabel = "com.omprabhu31.plip-overlay"
let disabledMarker = plipDir.appendingPathComponent("overlay-disabled")

@discardableResult
func launchctl(_ args: String...) -> Int32 {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/bin/launchctl")
    p.arguments = args
    p.standardOutput = FileHandle.nullDevice
    p.standardError = FileHandle.nullDevice
    guard (try? p.run()) != nil else { return -1 }
    p.waitUntilExit()
    return p.terminationStatus
}

let args = CommandLine.arguments
let snapshotPath = args.firstIndex(of: "--snapshot").flatMap { args.indices.contains($0 + 1) ? args[$0 + 1] : nil }

let isCheckRun = snapshotPath != nil || args.contains("--open-claude")

// One Plip at a time.
let me = Bundle.main.bundleIdentifier ?? serviceLabel
if !isCheckRun, NSRunningApplication.runningApplications(withBundleIdentifier: me).contains(where: { $0 != .current }) {
    exit(0)
}

// Opening Plip Overlay yourself (not launchd at login) turns it back on.
let isFromLogin = ProcessInfo.processInfo.environment["XPC_SERVICE_NAME"] == serviceLabel
if !isCheckRun, !isFromLogin, FileManager.default.fileExists(atPath: disabledMarker.path) {
    try? FileManager.default.removeItem(at: disabledMarker)
    launchctl("enable", "gui/\(getuid())/\(serviceLabel)")
}

let app = NSApplication.shared
let overlay = Overlay()
app.delegate = overlay
app.setActivationPolicy(.accessory)
app.run()
