# RadioScout release keeps. R8 (minifyEnabled + shrinkResources in
# android/app/build.gradle) strips everything unreachable; Capacitor's
# reflective pieces below are the only project code it cannot see.
# Capacitor core, Media3 and Guava ship their own consumer keep rules.

# Annotations drive the Bridge dispatch (R8 full mode folds otherwise).
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Capacitor Bridge entry points and reflective plugin dispatch.
-keep public class com.getcapacitor.BridgeActivity
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    *;
}
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.PluginMethod <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
}

# App entry points (manifest components are kept anyway; this pins the
# audio package's reflective plugin methods and the DSP chain by name).
-keep public class io.github.double77x.radioscout.MainActivity
-keep public class io.github.double77x.radioscout.audio.** {
    *;
}
-keepclassmembers class io.github.double77x.radioscout.audio.NativeAudioPlugin {
    @com.getcapacitor.annotation.PluginMethod <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
}

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
