package io.github.double77x.radioscout;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.github.double77x.radioscout.audio.NativeAudioPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeAudioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
