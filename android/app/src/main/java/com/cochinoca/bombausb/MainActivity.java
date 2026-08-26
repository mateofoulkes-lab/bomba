package com.cochinoca.bombausb;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialPort;
import com.hoho.android.usbserial.driver.UsbSerialProber;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends android.app.Activity {
    private static final String ACTION_USB_PERMISSION = "com.cochinoca.bombausb.USB_PERMISSION";
    private static final int BAUD = 115200;

    private WebView webView;
    private UsbManager usbManager;
    private UsbSerialPort serialPort;
    private UsbDeviceConnection connection;
    private Thread readerThread;
    private final AtomicBoolean reading = new AtomicBoolean(false);

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
            UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
            if (granted && device != null) {
                openDevice(device);
            } else {
                emitStatus("PERMISO USB DENEGADO");
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        usbManager = (UsbManager) getSystemService(Context.USB_SERVICE);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new UsbBridge(), "AndroidUsb");
        webView.loadUrl("file:///android_asset/index.html");

        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(usbReceiver, filter);
        }
    }

    public class UsbBridge {
        @JavascriptInterface
        public void connect() {
            runOnUiThread(() -> findAndRequestDevice());
        }

        @JavascriptInterface
        public void send(String command) {
            sendSerial(command);
        }

        @JavascriptInterface
        public void disconnect() {
            closeSerial();
        }

        @JavascriptInterface
        public boolean isConnected() {
            return serialPort != null;
        }
    }

    private void findAndRequestDevice() {
        List<UsbSerialDriver> drivers = UsbSerialProber.getDefaultProber().findAllDrivers(usbManager);
        if (drivers.isEmpty()) {
            emitStatus("NO SE ENCONTRÓ UN NANO USB SERIAL COMPATIBLE");
            return;
        }

        UsbDevice device = drivers.get(0).getDevice();
        if (usbManager.hasPermission(device)) {
            openDevice(device);
            return;
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        PendingIntent permissionIntent = PendingIntent.getBroadcast(this, 0, new Intent(ACTION_USB_PERMISSION), flags);
        usbManager.requestPermission(device, permissionIntent);
        emitStatus("ESPERANDO PERMISO USB…");
    }

    private synchronized void openDevice(UsbDevice device) {
        closeSerial();

        try {
            UsbSerialDriver selected = null;
            for (UsbSerialDriver driver : UsbSerialProber.getDefaultProber().findAllDrivers(usbManager)) {
                if (driver.getDevice().getDeviceId() == device.getDeviceId()) {
                    selected = driver;
                    break;
                }
            }
            if (selected == null) {
                emitStatus("DRIVER USB NO ENCONTRADO");
                return;
            }

            connection = usbManager.openDevice(selected.getDevice());
            if (connection == null) {
                emitStatus("NO SE PUDO ABRIR EL USB");
                return;
            }

            serialPort = selected.getPorts().get(0);
            serialPort.open(connection);
            serialPort.setParameters(BAUD, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE);
            try { serialPort.setDTR(true); } catch (Exception ignored) {}
            try { serialPort.setRTS(true); } catch (Exception ignored) {}

            emitStatus("CONECTADO · " + selected.getDevice().getDeviceName());
            startReader();

            // El Nano puede reiniciarse al abrir el puerto. Pedimos estado un momento después.
            webView.postDelayed(() -> sendSerial("ESTADO"), 1200);
        } catch (Exception e) {
            emitStatus("ERROR USB: " + e.getMessage());
            closeSerial();
        }
    }

    private void sendSerial(String command) {
        UsbSerialPort port = serialPort;
        if (port == null) {
            emitStatus("USB NO CONECTADO");
            return;
        }

        new Thread(() -> {
            try {
                byte[] bytes = (command.trim() + "\n").getBytes(StandardCharsets.UTF_8);
                port.write(bytes, 1000);
            } catch (Exception e) {
                emitStatus("ERROR AL ENVIAR: " + e.getMessage());
            }
        }, "usb-writer").start();
    }

    private void startReader() {
        if (reading.getAndSet(true)) return;

        readerThread = new Thread(() -> {
            byte[] buffer = new byte[256];
            StringBuilder pending = new StringBuilder();

            while (reading.get()) {
                try {
                    UsbSerialPort port = serialPort;
                    if (port == null) break;
                    int len = port.read(buffer, 500);
                    if (len <= 0) continue;

                    pending.append(new String(buffer, 0, len, StandardCharsets.UTF_8));
                    int newline;
                    while ((newline = pending.indexOf("\n")) >= 0) {
                        String line = pending.substring(0, newline).replace("\r", "").trim();
                        pending.delete(0, newline + 1);
                        if (!line.isEmpty()) emitData(line);
                    }
                } catch (Exception e) {
                    if (reading.get()) emitStatus("USB DESCONECTADO");
                    break;
                }
            }
            reading.set(false);
        }, "usb-reader");
        readerThread.start();
    }

    private void emitStatus(String status) {
        runOnUiThread(() -> webView.evaluateJavascript(
                "window.usbBridgeStatus && window.usbBridgeStatus(" + jsString(status) + ");", null));
    }

    private void emitData(String data) {
        runOnUiThread(() -> webView.evaluateJavascript(
                "window.usbBridgeData && window.usbBridgeData(" + jsString(data) + ");", null));
    }

    private String jsString(String value) {
        return "\"" + value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "") + "\"";
    }

    private synchronized void closeSerial() {
        reading.set(false);
        if (readerThread != null) {
            readerThread.interrupt();
            readerThread = null;
        }
        try { if (serialPort != null) serialPort.close(); } catch (Exception ignored) {}
        try { if (connection != null) connection.close(); } catch (Exception ignored) {}
        serialPort = null;
        connection = null;
    }

    @Override
    protected void onDestroy() {
        closeSerial();
        try { unregisterReceiver(usbReceiver); } catch (Exception ignored) {}
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
