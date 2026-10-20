package io.github.double77x.radioscout;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import io.github.double77x.radioscout.audio.NativeAudioPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // releaseTest is non-debuggable so R8 runs exactly as it does for the
        // shipped release. The smoke still needs the WebView devtools socket;
        // this flag is true only in that test variant.
        if (BuildConfig.WEBVIEW_DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        registerPlugin(NativeAudioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
