package com.cochinoca.bombausb;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ActivityInfo;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialPort;
import com.hoho.android.usbserial.driver.UsbSerialProber;
import com.hoho.android.usbserial.util.SerialInputOutputManager;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Final birthday-game activity.
 * Keeps the already-proven usb-serial-for-android approach, but exposes it to
 * the HTML game through a tiny JavaScript bridge.
 */
public class FinalActivity extends AppCompatActivity implements SerialInputOutputManager.Listener {
    private static final String ACTION_USB_PERMISSION = "com.cochinoca.bombausb.USB_PERMISSION_FINAL";
    private static final int BAUD = 115200;

    private WebView webView;
    private UsbManager usbManager;
    private UsbSerialPort serialPort;
    private SerialInputOutputManager ioManager;
    private StringBuilder rxBuffer = new StringBuilder();
    private boolean receiverRegistered = false;

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
            UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
            if (granted && device != null) openDevice(device);
            else jsUsbState("permiso USB rechazado");
        }
    };

    @Override protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        immersive();

        usbManager = (UsbManager) getSystemService(Context.USB_SERVICE);
        registerUsbReceiver();

        webView = new WebView(this);
        setContentView(webView);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new Bridge(), "Android");
        webView.loadUrl("file:///android_asset/final/index.html");
    }

    private void registerUsbReceiver() {
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(usbReceiver, filter);
        receiverRegistered = true;
    }

    private void immersive() {
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
                View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    private void connectUsb() {
        List<UsbSerialDriver> drivers = UsbSerialProber.getDefaultProber().findAllDrivers(usbManager);
        if (drivers.isEmpty()) {
            jsUsbState("Nano no encontrado");
            toast("Nano no encontrado");
            return;
        }
        UsbSerialDriver driver = drivers.get(0);
        UsbDevice device = driver.getDevice();
        if (!usbManager.hasPermission(device)) {
            int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
            PendingIntent pi = PendingIntent.getBroadcast(this, 0, new Intent(ACTION_USB_PERMISSION).setPackage(getPackageName()), flags);
            usbManager.requestPermission(device, pi);
            jsUsbState("esperando permiso USB");
            return;
        }
        openDevice(device);
    }

    private void openDevice(UsbDevice device) {
        try {
            closeSerial();
            UsbSerialDriver found = null;
            for (UsbSerialDriver d : UsbSerialProber.getDefaultProber().findAllDrivers(usbManager)) {
                if (d.getDevice().getDeviceId() == device.getDeviceId()) { found = d; break; }
            }
            if (found == null) throw new Exception("driver serial no encontrado");
            UsbDeviceConnection connection = usbManager.openDevice(device);
            if (connection == null) throw new Exception("no se pudo abrir el dispositivo USB");
            serialPort = found.getPorts().get(0);
            serialPort.open(connection);
            serialPort.setParameters(BAUD, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE);
            try { serialPort.setDTR(true); serialPort.setRTS(true); } catch (Exception ignored) {}
            ioManager = new SerialInputOutputManager(serialPort, this);
            ioManager.start();
            jsUsbState("conectado 115200");
            toast("Nano conectado");
        } catch (Exception e) {
            closeSerial();
            jsUsbState("error: " + e.getMessage());
            toast("USB: " + e.getMessage());
        }
    }

    private void sendSerial(String text) {
        if (serialPort == null) { jsUsbState("Nano desconectado"); return; }
        try {
            String line = text.endsWith("\n") ? text : text + "\n";
            serialPort.write(line.getBytes(StandardCharsets.UTF_8), 1000);
        } catch (Exception e) {
            jsUsbState("TX error: " + e.getMessage());
        }
    }

    @Override public void onNewData(byte[] data) {
        final String chunk = new String(data, StandardCharsets.UTF_8);
        runOnUiThread(() -> {
            rxBuffer.append(chunk);
            int nl;
            while ((nl = indexOfNewline(rxBuffer)) >= 0) {
                String line = rxBuffer.substring(0, nl).replace("\r", "").trim();
                rxBuffer.delete(0, nl + 1);
                if (!line.isEmpty()) jsSerialLine(line);
            }
        });
    }

    private int indexOfNewline(StringBuilder b) {
        for (int i=0;i<b.length();i++) if (b.charAt(i)=='\n') return i;
        return -1;
    }

    @Override public void onRunError(Exception e) {
        runOnUiThread(() -> jsUsbState("serial detenido: " + e.getMessage()));
    }

    private void jsSerialLine(String line) {
        if (webView == null) return;
        webView.evaluateJavascript("window.BombNative&&window.BombNative.onSerialLine(" + JSONObject.quote(line) + ");", null);
    }

    private void jsUsbState(String status) {
        if (webView == null) return;
        runOnUiThread(() -> webView.evaluateJavascript("window.BombNative&&window.BombNative.onUsbState(" + JSONObject.quote(status) + ");", null));
    }

    private void toast(String s) { runOnUiThread(() -> Toast.makeText(this, s, Toast.LENGTH_SHORT).show()); }

    private void closeSerial() {
        try { if (ioManager != null) ioManager.stop(); } catch (Exception ignored) {}
        ioManager = null;
        try { if (serialPort != null) serialPort.close(); } catch (Exception ignored) {}
        serialPort = null;
    }

    @Override protected void onDestroy() {
        closeSerial();
        if (receiverRegistered) { try { unregisterReceiver(usbReceiver); } catch (Exception ignored) {} }
        if (webView != null) { webView.removeJavascriptInterface("Android"); webView.destroy(); }
        super.onDestroy();
    }

    public class Bridge {
        @JavascriptInterface public void connectUsb() { runOnUiThread(() -> FinalActivity.this.connectUsb()); }
        @JavascriptInterface public void connect() { connectUsb(); }
        @JavascriptInterface public void connectNano() { connectUsb(); }
        @JavascriptInterface public void sendSerial(String line) { FinalActivity.this.sendSerial(line); }
        @JavascriptInterface public void send(String line) { sendSerial(line); }
        @JavascriptInterface public void writeSerial(String line) { sendSerial(line); }
        @JavascriptInterface public void immersive() { runOnUiThread(() -> FinalActivity.this.immersive()); }
    }
}