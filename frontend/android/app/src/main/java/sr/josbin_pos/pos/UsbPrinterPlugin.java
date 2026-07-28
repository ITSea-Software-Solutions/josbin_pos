package sr.josbin_pos.pos;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;

/**
 * Direct USB printing on Android via the USB Host API.
 *
 * Android has no print spooler for raw ESC/POS, but it does let an app claim
 * a USB device and push bytes at its bulk endpoint — which is exactly what a
 * receipt printer wants. This is how Android POS software drives USB
 * printers, and it means a USB-only printer needs neither a LAN interface
 * card nor a Windows PC acting as a bridge.
 *
 * Devices are addressed by vendor+product id rather than Android's
 * deviceId, because deviceId changes every time the cable is replugged and
 * a till's saved printer must survive that.
 */
@CapacitorPlugin(name = "UsbPrinter")
public class UsbPrinterPlugin extends Plugin {

    private static final String ACTION_USB_PERMISSION = "sr.josbin_pos.pos.USB_PERMISSION";
    private static final int WRITE_TIMEOUT_MS = 5000;
    private static final int CHUNK = 4096;

    private UsbManager usbManager() {
        return (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
    }

    /**
     * Clear a stalled bulk endpoint — USB's standard
     * CLEAR_FEATURE(ENDPOINT_HALT) request.
     *
     * A halted endpoint refuses every transfer, forever, having moved zero
     * bytes. Android's UsbDeviceConnection exposes no dedicated call for this,
     * but the request is a plain control transfer on endpoint 0:
     *
     *   bmRequestType 0x02  host→device, standard, recipient = endpoint
     *   bRequest      0x01  CLEAR_FEATURE
     *   wValue        0x00  ENDPOINT_HALT
     *   wIndex              the endpoint's address
     *
     * @return true when the device accepted the request.
     */
    private boolean clearHalt(UsbDeviceConnection conn, UsbEndpoint ep) {
        try {
            return conn.controlTransfer(0x02, 0x01, 0x00, ep.getAddress(), null, 0, 1000) >= 0;
        } catch (Exception e) {
            return false;
        }
    }

    private UsbDevice findDevice(int vendorId, int productId) {
        HashMap<String, UsbDevice> devices = usbManager().getDeviceList();
        for (UsbDevice d : devices.values()) {
            if (d.getVendorId() == vendorId && d.getProductId() == productId) return d;
        }
        return null;
    }

    /** Printer-class interface if the device declares one, else any interface with a bulk OUT endpoint. */
    private UsbInterface printerInterface(UsbDevice device) {
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface intf = device.getInterface(i);
            if (intf.getInterfaceClass() == UsbConstants.USB_CLASS_PRINTER) return intf;
        }
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface intf = device.getInterface(i);
            for (int e = 0; e < intf.getEndpointCount(); e++) {
                UsbEndpoint ep = intf.getEndpoint(e);
                if (ep.getDirection() == UsbConstants.USB_DIR_OUT
                        && ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                    return intf;
                }
            }
        }
        return null;
    }

    private UsbEndpoint bulkOut(UsbInterface intf) {
        for (int e = 0; e < intf.getEndpointCount(); e++) {
            UsbEndpoint ep = intf.getEndpoint(e);
            if (ep.getDirection() == UsbConstants.USB_DIR_OUT
                    && ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                return ep;
            }
        }
        return null;
    }

    /** Human-readable USB class, so a support call can name what is plugged in. */
    private String className(int usbClass) {
        switch (usbClass) {
            case UsbConstants.USB_CLASS_PER_INTERFACE: return "per-interface";
            case UsbConstants.USB_CLASS_AUDIO:         return "audio";
            case UsbConstants.USB_CLASS_COMM:          return "serial/CDC";
            case UsbConstants.USB_CLASS_HID:           return "keyboard/HID (scanner)";
            case UsbConstants.USB_CLASS_PRINTER:       return "printer";
            case UsbConstants.USB_CLASS_MASS_STORAGE:  return "storage";
            case UsbConstants.USB_CLASS_HUB:           return "hub";
            case UsbConstants.USB_CLASS_CDC_DATA:      return "serial data";
            case UsbConstants.USB_CLASS_VENDOR_SPEC:   return "vendor-specific";
            default: return "class " + usbClass;
        }
    }

    @PluginMethod
    public void listDevices(PluginCall call) {
        JSArray out = new JSArray();
        UsbManager mgr = usbManager();
        for (UsbDevice d : mgr.getDeviceList().values()) {
            UsbInterface intf = printerInterface(d);
            boolean printable = intf != null && bulkOut(intf) != null;

            JSObject o = new JSObject();
            o.put("name", d.getProductName() != null ? d.getProductName() : d.getDeviceName());
            o.put("manufacturer", d.getManufacturerName());
            o.put("vendorId", d.getVendorId());
            o.put("productId", d.getProductId());
            // A device with no bulk OUT endpoint can never take print data —
            // tell the UI so it can grey it out instead of failing later.
            o.put("printable", printable);
            o.put("hasPermission", mgr.hasPermission(d));

            // Diagnostics. When a printer is plugged in but refuses to appear
            // as printable, these are the only facts that explain why, and a
            // cashier cannot be asked to read a USB descriptor off a datasheet.
            o.put("deviceClass", d.getDeviceClass());
            o.put("deviceClassName", className(d.getDeviceClass()));
            o.put("interfaceCount", d.getInterfaceCount());
            JSArray ifaces = new JSArray();
            for (int i = 0; i < d.getInterfaceCount(); i++) {
                UsbInterface u = d.getInterface(i);
                JSObject io = new JSObject();
                io.put("class", u.getInterfaceClass());
                io.put("className", className(u.getInterfaceClass()));
                io.put("subclass", u.getInterfaceSubclass());
                io.put("protocol", u.getInterfaceProtocol());
                io.put("endpoints", u.getEndpointCount());
                ifaces.put(io);
            }
            o.put("interfaces", ifaces);
            if (!printable) {
                o.put("reason", d.getInterfaceCount() == 0
                        ? "device reports no USB interfaces"
                        : "no bulk OUT endpoint on any interface — this is not a printer");
            }
            out.put(o);
        }

        JSObject ret = new JSObject();
        ret.put("devices", out);
        ret.put("count", out.length());
        // Distinguishes "nothing plugged in" from "this terminal cannot host
        // USB devices at all" — two identical-looking empty lists with very
        // different answers.
        ret.put("hostSupport", getContext().getPackageManager()
                .hasSystemFeature(android.content.pm.PackageManager.FEATURE_USB_HOST));
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(final PluginCall call) {
        final int vendorId = call.getInt("vendorId", -1);
        final int productId = call.getInt("productId", -1);
        UsbDevice device = findDevice(vendorId, productId);
        if (device == null) {
            call.reject("USB device not found — is it plugged in and powered on?");
            return;
        }

        UsbManager mgr = usbManager();
        if (mgr.hasPermission(device)) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        final BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
                try {
                    getContext().unregisterReceiver(this);
                } catch (Exception ignored) {
                }
                boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                JSObject ret = new JSObject();
                ret.put("granted", granted);
                call.resolve(ret);
            }
        };

        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ requires an explicit export flag; our action is private.
            getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(receiver, filter);
        }

        // FLAG_IMMUTABLE is mandatory from Android 12 (targetSdk 31+).
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent pi = PendingIntent.getBroadcast(
                getContext(), 0, new Intent(ACTION_USB_PERMISSION), flags);
        mgr.requestPermission(device, pi);
    }

    @PluginMethod
    public void print(PluginCall call) {
        int vendorId = call.getInt("vendorId", -1);
        int productId = call.getInt("productId", -1);
        JSArray data = call.getArray("data");
        if (data == null) {
            call.reject("data is required");
            return;
        }

        UsbDevice device = findDevice(vendorId, productId);
        if (device == null) {
            call.reject("USB printer not connected (vendor " + vendorId + ", product " + productId + ")");
            return;
        }

        UsbManager mgr = usbManager();
        if (!mgr.hasPermission(device)) {
            call.reject("No USB permission for this printer — tap 'Connect USB printer' in Settings → Hardware");
            return;
        }

        UsbInterface intf = printerInterface(device);
        if (intf == null) {
            call.reject("This USB device has no printer interface");
            return;
        }
        UsbEndpoint ep = bulkOut(intf);
        if (ep == null) {
            call.reject("This USB device has no bulk OUT endpoint (cannot receive print data)");
            return;
        }

        byte[] bytes;
        try {
            bytes = new byte[data.length()];
            for (int i = 0; i < data.length(); i++) {
                bytes[i] = (byte) data.getInt(i);
            }
        } catch (Exception e) {
            call.reject("Bad print payload: " + e.getMessage());
            return;
        }

        UsbDeviceConnection conn = mgr.openDevice(device);
        if (conn == null) {
            call.reject("Could not open the USB printer (another app may be holding it)");
            return;
        }

        try {
            if (!conn.claimInterface(intf, true)) {
                call.reject("Could not claim the printer interface");
                return;
            }
            // Bulk transfers are capped per call; a receipt is small but a
            // label sheet or a long Z-report is not.
            int offset = 0;
            while (offset < bytes.length) {
                int len = Math.min(CHUNK, bytes.length - offset);
                byte[] chunk = new byte[len];
                System.arraycopy(bytes, offset, chunk, 0, len);
                int sent = conn.bulkTransfer(ep, chunk, len, WRITE_TIMEOUT_MS);

                // A transfer that returns -1 having moved ZERO bytes is not a
                // busy printer — it is a HALTED endpoint, and no amount of
                // waiting clears one.
                //
                // How we get there: every call here force-claims the interface
                // and closes it again afterwards. When the cash-drawer pulse
                // follows a receipt, that second force-claim lands while the
                // printer is still physically printing, and tearing the
                // interface down and back up mid-job stalls the bulk OUT
                // endpoint on a lot of printer silicon. After that EVERY
                // transfer returns 0 bytes regardless of size or timeout —
                // which is exactly what the field reported twice: first a
                // 5-byte pulse refused, then a 10-byte one refused
                // identically, while full receipts kept printing fine. The
                // size was never the variable.
                //
                // USB's own remedy is CLEAR_FEATURE(ENDPOINT_HALT), so send
                // that and retry rather than sleeping and hoping.
                if (sent == 0 || sent < 0) {
                    boolean cleared = clearHalt(conn, ep);
                    try { Thread.sleep(120); } catch (InterruptedException ignored) {}
                    sent = conn.bulkTransfer(ep, chunk, len, WRITE_TIMEOUT_MS);

                    // Still refused: re-seat the interface entirely, which
                    // recovers a device whose whole configuration got wedged.
                    if (sent < 0) {
                        try {
                            conn.releaseInterface(intf);
                            conn.claimInterface(intf, true);
                            clearHalt(conn, ep);
                            Thread.sleep(200);
                        } catch (Exception ignored) {}
                        sent = conn.bulkTransfer(ep, chunk, len, WRITE_TIMEOUT_MS);
                    }

                    if (sent < 0) {
                        call.reject("USB write failed after " + offset + " of " + bytes.length
                                + " bytes — the printer's data endpoint is stalled"
                                + (cleared ? " (clear-halt sent, still refused)" : " (clear-halt was rejected too)")
                                + ". Unplug the printer's USB cable, plug it back in, and try again.");
                        return;
                    }
                }
                offset += sent;
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("bytes", offset);
            call.resolve(ret);
        } finally {
            try { conn.releaseInterface(intf); } catch (Exception ignored) {}
            conn.close();
        }
    }
}
