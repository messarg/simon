// Simon for macOS — a native window around the same app a shop's tills open.
//
// The bundle carries its own Node runtime, the API and the built SPA. On launch it starts the API
// on the loopback interface, waits for it to answer, and shows the app in a WKWebView. The shop's
// data lives in ~/Library/Application Support/Simon, never inside the bundle, so replacing the app
// never touches it (PRD §19.2).
//
// This is a single-machine preview. A shop install serves phones over TLS behind Nginx (§16.6);
// this window listens on 127.0.0.1 only, so nothing else on the network can reach it.

import AppKit
import WebKit

/// Fixed rather than random: the till's offline cache and its queue of unsent sales live in the
/// page's storage, which is keyed by origin — a new port each launch would silently lose them.
let port = 47_800
let appURL = URL(string: "http://127.0.0.1:\(port)/")!
let healthURL = URL(string: "http://127.0.0.1:\(port)/api/health")!

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var status: NSTextField!
    private var server: Process?
    private var downloads: [ObjectIdentifier: URL] = [:]

    private let fm = FileManager.default
    private lazy var support = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Simon", isDirectory: true)
    private lazy var logs = fm.urls(for: .libraryDirectory, in: .userDomainMask)[0].appendingPathComponent("Logs/Simon", isDirectory: true)

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        buildWindow()
        Task { await start() }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) {
        guard let server, server.isRunning else { return }
        // SIGTERM: the API closes the database cleanly (backend/src/index.ts).
        server.terminate()
        let deadline = Date().addingTimeInterval(4)
        while server.isRunning && Date() < deadline { usleep(50_000) }
        if server.isRunning { kill(server.processIdentifier, SIGKILL) }
    }

    // MARK: - The API

    private func start() async {
        if await healthy() {
            // Already answering — a server left from an earlier launch. Use it rather than fight it.
            await MainActor.run { show() }
            return
        }
        do {
            try launchServer()
        } catch {
            await MainActor.run { fail("Սերվերը չհաջողվեց գործարկել։\n\(error.localizedDescription)") }
            return
        }
        for _ in 0..<240 {
            if await healthy() { await MainActor.run { show() }; return }
            if server?.isRunning == false { break }
            try? await Task.sleep(nanoseconds: 250_000_000)
        }
        await MainActor.run {
            fail("Սիմոնը չպատասխանեց։ Մանրամասները՝\n\(logs.appendingPathComponent("server.log").path)")
        }
    }

    private func healthy() async -> Bool {
        var request = URLRequest(url: healthURL)
        request.timeoutInterval = 1
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200 else { return false }
        return String(data: data, encoding: .utf8)?.contains("\"ok\"") == true
    }

    private func launchServer() throws {
        let resources = Bundle.main.resourceURL!
        let app = resources.appendingPathComponent("app", isDirectory: true)
        let dirs = ["data", "backups", "keys", "prints"].map { support.appendingPathComponent($0, isDirectory: true) }
        for dir in dirs + [logs] { try fm.createDirectory(at: dir, withIntermediateDirectories: true) }
        try fm.setAttributes([.posixPermissions: 0o700], ofItemAtPath: support.appendingPathComponent("keys").path)

        let logFile = logs.appendingPathComponent("server.log")
        if !fm.fileExists(atPath: logFile.path) { fm.createFile(atPath: logFile.path, contents: nil) }
        let handle = try FileHandle(forWritingTo: logFile)
        handle.seekToEndOfFile()

        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
        let p = Process()
        p.executableURL = resources.appendingPathComponent("node")
        p.arguments = ["--experimental-strip-types", "--no-warnings", "backend/src/index.ts"]
        p.currentDirectoryURL = app
        p.environment = [
            "NODE_ENV": "production",
            "HOST": "127.0.0.1",
            "PORT": String(port),
            "SIMON_VERSION": version,
            "SIMON_STATIC_DIR": app.appendingPathComponent("frontend/dist").path,
            "SIMON_DATA_DIR": dirs[0].path,
            "SIMON_BACKUP_DIR": dirs[1].path,
            "SIMON_KEY_DIR": dirs[2].path,
            "SIMON_PRINT_DIR": dirs[3].path,
            "SIMON_LOG_DIR": logs.path,
            "LOG_LEVEL": "warn",
            "HOME": NSHomeDirectory(),
        ]
        p.standardOutput = handle
        p.standardError = handle
        p.terminationHandler = { [weak self] proc in
            // A server that dies under an open window must say so rather than leave a blank page.
            guard proc.terminationReason == .uncaughtSignal || proc.terminationStatus != 0 else { return }
            DispatchQueue.main.async { self?.status.stringValue = "Սիմոնի սերվերը կանգ առավ։ Վերագործարկե՛ք ծրագիրը։" }
        }
        try p.run()
        server = p
    }

    // MARK: - The window

    private func buildWindow() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // persistent: the offline cache and the queue survive a restart
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        // WKWebView does not implement window.print(); label sheets and orders ask through this.
        config.userContentController.add(self, name: "simonPrint")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isHidden = true
        webView.setValue(false, forKey: "drawsBackground")

        status = NSTextField(labelWithString: "Սիմոնը բացվում է…")
        status.font = .systemFont(ofSize: 17, weight: .medium)
        status.textColor = .secondaryLabelColor
        status.alignment = .center
        status.maximumNumberOfLines = 0
        status.translatesAutoresizingMaskIntoConstraints = false

        let root = NSView()
        root.wantsLayer = true
        // The SPA's --background (#EDF0DE), so the launch window matches the page that replaces it.
        // sRGB, not calibrated: the web view renders sRGB, and a flat fill makes any mismatch visible.
        root.layer?.backgroundColor = NSColor(srgbRed: 0.929, green: 0.941, blue: 0.871, alpha: 1).cgColor
        webView.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(webView)
        root.addSubview(status)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            webView.topAnchor.constraint(equalTo: root.topAnchor),
            webView.bottomAnchor.constraint(equalTo: root.bottomAnchor),
            status.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            status.centerYAnchor.constraint(equalTo: root.centerYAnchor),
            status.widthAnchor.constraint(lessThanOrEqualTo: root.widthAnchor, constant: -80),
        ])

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 840),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Սիմոն"
        window.minSize = NSSize(width: 380, height: 600)
        window.contentView = root
        window.center()
        window.setFrameAutosaveName("SimonMainWindow")
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func show() {
        webView.load(URLRequest(url: appURL))
    }

    private func fail(_ message: String) {
        status.stringValue = message
        let alert = NSAlert()
        alert.messageText = "Սիմոն"
        alert.informativeText = message
        alert.addButton(withTitle: "Բացել մատյանների պանակը")
        alert.addButton(withTitle: "Փակել")
        if alert.runModal() == .alertFirstButtonReturn { NSWorkspace.shared.open(logs) }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.isHidden = false
        status.isHidden = true
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        status.isHidden = false
        status.stringValue = error.localizedDescription
    }

    // MARK: - Links, downloads, files, camera

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 preferences: WKWebpagePreferences,
                 decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void) {
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download, preferences)
            return
        }
        // Anything outside the app opens in the person's browser, never inside the till.
        if let url = navigationAction.request.url, ["http", "https"].contains(url.scheme ?? ""), url.host != "127.0.0.1" {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel, preferences)
            return
        }
        decisionHandler(.allow, preferences)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    /// Report exports and diagnostics land in Downloads, never overwriting an earlier file.
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let folder = fm.urls(for: .downloadsDirectory, in: .userDomainMask)[0]
        let name = (suggestedFilename as NSString)
        var target = folder.appendingPathComponent(suggestedFilename)
        var n = 1
        while fm.fileExists(atPath: target.path) {
            let numbered = name.pathExtension.isEmpty
                ? "\(name.deletingPathExtension) (\(n))"
                : "\(name.deletingPathExtension) (\(n)).\(name.pathExtension)"
            target = folder.appendingPathComponent(numbered)
            n += 1
        }
        downloads[ObjectIdentifier(download)] = target
        completionHandler(target)
    }

    func downloadDidFinish(_ download: WKDownload) {
        if let url = downloads.removeValue(forKey: ObjectIdentifier(download)) {
            NSWorkspace.shared.activateFileViewerSelecting([url])
        }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloads.removeValue(forKey: ObjectIdentifier(download))
    }

    /// The import screen's file picker (§7.3).
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = false
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.urls : nil) }
    }

    /// Camera scanning (§18). Loopback is a secure context, so the camera works here without TLS.
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host == "127.0.0.1" ? .grant : .deny)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }

    // MARK: - Printing

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "simonPrint" else { return }
        printPage(nil)
    }

    @objc private func printPage(_ sender: Any?) {
        let info = NSPrintInfo.shared.copy() as! NSPrintInfo
        info.horizontalPagination = .fit
        info.verticalPagination = .automatic
        info.topMargin = 28; info.bottomMargin = 28; info.leftMargin = 28; info.rightMargin = 28
        let operation = webView.printOperation(with: info)
        operation.view?.frame = webView.bounds
        operation.runModal(for: window, delegate: nil, didRun: nil, contextInfo: nil)
    }

    // MARK: - Menu

    @objc private func reload(_ sender: Any?) { webView.reload() }
    @objc private func showData(_ sender: Any?) { NSWorkspace.shared.open(support) }
    @objc private func showLogs(_ sender: Any?) { NSWorkspace.shared.open(logs) }
    @objc private func zoomIn(_ sender: Any?) { webView.pageZoom = min(webView.pageZoom + 0.1, 2) }
    @objc private func zoomOut(_ sender: Any?) { webView.pageZoom = max(webView.pageZoom - 0.1, 0.6) }
    @objc private func zoomReset(_ sender: Any?) { webView.pageZoom = 1 }

    private func buildMenu() {
        let main = NSMenu()

        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Simon", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Show Data Folder", action: #selector(showData(_:)), keyEquivalent: "")
        appMenu.addItem(withTitle: "Show Logs", action: #selector(showLogs(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Print…", action: #selector(printPage(_:)), keyEquivalent: "p")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide Simon", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Quit Simon", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        main.addItem(submenu(appMenu, title: "Simon"))

        // Without an Edit menu, ⌘C and ⌘V do nothing inside a web view.
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        main.addItem(submenu(edit, title: "Edit"))

        let view = NSMenu(title: "View")
        view.addItem(withTitle: "Reload", action: #selector(reload(_:)), keyEquivalent: "r")
        view.addItem(.separator())
        view.addItem(withTitle: "Actual Size", action: #selector(zoomReset(_:)), keyEquivalent: "0")
        view.addItem(withTitle: "Zoom In", action: #selector(zoomIn(_:)), keyEquivalent: "+")
        view.addItem(withTitle: "Zoom Out", action: #selector(zoomOut(_:)), keyEquivalent: "-")
        view.addItem(.separator())
        view.addItem(withTitle: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f").keyEquivalentModifierMask = [.command, .control]
        main.addItem(submenu(view, title: "View"))

        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        main.addItem(submenu(windowMenu, title: "Window"))
        NSApp.windowsMenu = windowMenu

        NSApp.mainMenu = main
    }

    private func submenu(_ menu: NSMenu, title: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        item.submenu = menu
        return item
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
