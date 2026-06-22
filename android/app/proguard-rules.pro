# AlbaBiz Android — ProGuard / R8 rules.
# The app is a thin WebView shell; almost nothing needs keeping. WebView's
# JavascriptInterface is not used for sensitive bridges here, but if you add an
# @JavascriptInterface class later, keep its methods:
# -keepclassmembers class com.zonetech.albabiz.web.** {
#     @android.webkit.JavascriptInterface <methods>;
# }

# org.json is part of the platform; nothing to keep.
-dontwarn org.conscrypt.**
