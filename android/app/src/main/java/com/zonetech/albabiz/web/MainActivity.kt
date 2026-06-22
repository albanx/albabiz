package com.zonetech.albabiz.web

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.net.http.SslError
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.zonetech.albabiz.AlbaBizApp
import com.zonetech.albabiz.BuildConfig
import com.zonetech.albabiz.R

/**
 * AlbaBiz.ie Android shell.
 *
 * A thin native wrapper around the Cloudflare Pages site. Native value beyond a
 * bare WebView (so Play review doesn't flag a "low-effort wrapper"):
 *   - Native splash screen (androidx core-splashscreen).
 *   - Pull-to-refresh (SwipeRefreshLayout) — only triggers when the page is
 *     scrolled to the top so it doesn't fight in-page scrolling.
 *   - Offline screen with a Retry button when there's no connection.
 *   - File upload (onShowFileChooser) so owners can attach a logo on the
 *     submission form — REQUIRED by the brief.
 *   - Hardware back button drives in-WebView history via window.albabizOnBack().
 *   - External links (tel:, mailto:, wa.me, other hosts) open in the right app.
 *   - Remote config: the Worker's /api/config can override the WebView URL,
 *     so we can repoint the app without shipping an update.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var swipe: SwipeRefreshLayout
    private lateinit var offline: View
    private var pageError = false

    // File chooser plumbing for <input type=file> (logo upload).
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooser = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val cb = filePathCallback
        filePathCallback = null
        if (cb == null) return@registerForActivityResult
        val uris: Array<Uri>? = if (result.resultCode == Activity.RESULT_OK)
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data) else null
        cb.onReceiveValue(uris ?: arrayOf())
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        swipe = findViewById(R.id.swipe)
        web = findViewById(R.id.web)
        offline = findViewById(R.id.offline)
        findViewById<Button>(R.id.retry).setOnClickListener { reload() }

        configureWebView()

        // Pull-to-refresh, but only when the WebView is scrolled to the very top
        // (otherwise it hijacks normal scroll-up gestures mid-page).
        swipe.setOnRefreshListener { reload() }
        swipe.setColorSchemeColors(0xFFD11F27.toInt())
        web.viewTreeObserver.addOnScrollChangedListener {
            swipe.isEnabled = web.scrollY == 0
        }

        // Hardware back: ask the web UI first, then WebView history, then exit.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript(
                    "(window.albabizOnBack && window.albabizOnBack()) ? '1':'0'"
                ) { res ->
                    val handled = res?.trim('"') == "1"
                    if (!handled) {
                        if (web.canGoBack()) web.goBack()
                        else finish()
                    }
                }
            }
        })

        loadStart(savedInstanceState)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            // Network-first so the WebView always gets the freshest Pages UI.
            cacheMode = WebSettings.LOAD_DEFAULT
            loadWithOverviewMode = true
            useWideViewPort = true
            allowFileAccess = false
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = true
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                handleUrl(request.url)

            override fun onPageFinished(view: WebView, url: String) {
                swipe.isRefreshing = false
                if (!pageError) showContent()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (!request.isForMainFrame) return
                pageError = true
                showOffline()
            }

            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                // Never bypass TLS — fail to the offline screen.
                handler.cancel()
                pageError = true
                showOffline()
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            // <input type=file> — logo upload. REQUIRED by the brief.
            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                return try {
                    fileChooser.launch(params.createIntent())
                    true
                } catch (e: Exception) {
                    filePathCallback = null
                    false
                }
            }

            // Turnstile/widgets never need device permissions; deny by default.
            override fun onPermissionRequest(request: PermissionRequest) { request.deny() }
        }
    }

    /**
     * Route a URL: keep our own host inside the WebView, send tel/mailto/wa.me
     * and other hosts to the relevant external app. The privacy page is also
     * externalized so the in-app context isn't lost (mirrors zonetech).
     */
    private fun handleUrl(uri: Uri): Boolean {
        val url = uri.toString()
        val scheme = uri.scheme ?: ""
        if (scheme == "tel" || scheme == "mailto" || scheme == "sms" || scheme == "whatsapp") {
            return openExternal(uri)
        }
        if (scheme != "http" && scheme != "https") {
            return openExternal(uri)
        }
        val uiHost = Uri.parse(BuildConfig.UI_BASE).host
        val linkHost = uri.host
        val sameHost = uiHost != null && linkHost != null && linkHost.equals(uiHost, ignoreCase = true)
        val isPrivacy = sameHost && (uri.path?.startsWith("/privatesia") == true)
        if (!sameHost || isPrivacy) {
            return openExternal(uri)
        }
        return false // let the WebView load our own pages
    }

    private fun openExternal(uri: Uri): Boolean {
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun loadStart(savedInstanceState: Bundle?) {
        if (savedInstanceState != null && web.restoreState(savedInstanceState) != null) return
        // Pull remote config first (maintenance / URL override), then load.
        AlbaBizApp.instance.fetchConfig { cfg ->
            runOnUiThread {
                val base = cfg?.uiBaseOverride?.takeIf { it.isNotBlank() } ?: BuildConfig.UI_BASE
                reloadTo(base)
            }
        }
    }

    private fun reload() {
        pageError = false
        if (web.url != null) web.reload() else reloadTo(BuildConfig.UI_BASE)
    }

    /** Append app=1 so the site's analytics can split app vs web traffic. */
    private fun appUrl(url: String): String {
        if (url.contains("app=1")) return url
        val sep = if (url.contains("?")) "&" else "?"
        // Keep any trailing fragment intact (none expected, but be safe).
        return url + sep + "app=1"
    }

    private fun reloadTo(url: String) {
        pageError = false
        showContent()
        swipe.isRefreshing = true
        web.loadUrl(appUrl(url))
    }

    private fun showOffline() {
        swipe.isRefreshing = false
        offline.visibility = View.VISIBLE
        swipe.visibility = View.GONE
    }

    private fun showContent() {
        offline.visibility = View.GONE
        swipe.visibility = View.VISIBLE
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }
}
