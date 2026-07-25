package sr.josbin_pos.pos;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Raw TCP socket for ESC/POS printing (port 9100) and the cash-drawer pulse.
 *
 * Android's PrintManager cannot send raw bytes, so receipts and the drawer
 * kick go straight to the printer's network interface — the same strategy the
 * Electron main process uses (tcpPrint). JS side: registerPlugin('TcpSocket')
 * in src/lib/capacitor-printer.ts. One socket at a time is all a till needs.
 */
@CapacitorPlugin(name = "TcpSocket")
public class TcpSocketPlugin extends Plugin {

    private Socket socket;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private static final int CONNECT_TIMEOUT_MS = 3000;

    @PluginMethod
    public void connect(PluginCall call) {
        final String host = call.getString("host");
        final Integer port = call.getInt("port", 9100);
        if (host == null || host.isEmpty()) {
            call.reject("host is required");
            return;
        }
        io.execute(() -> {
            try {
                closeQuietly();
                Socket s = new Socket();
                s.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT_MS);
                socket = s;
                call.resolve();
            } catch (Exception e) {
                call.reject("connect failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void write(PluginCall call) {
        final JSArray data = call.getArray("data");
        if (data == null) {
            call.reject("data is required");
            return;
        }
        io.execute(() -> {
            try {
                if (socket == null || !socket.isConnected()) {
                    call.reject("not connected");
                    return;
                }
                byte[] bytes = new byte[data.length()];
                for (int i = 0; i < data.length(); i++) {
                    bytes[i] = (byte) data.getInt(i);
                }
                OutputStream out = socket.getOutputStream();
                out.write(bytes);
                out.flush();
                call.resolve();
            } catch (Exception e) {
                call.reject("write failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        io.execute(() -> {
            closeQuietly();
            call.resolve();
        });
    }

    private void closeQuietly() {
        try {
            if (socket != null) socket.close();
        } catch (Exception ignored) {
        }
        socket = null;
    }
}
