package sr.josbin_pos.pos;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before the bridge initialises.
        registerPlugin(TcpSocketPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
