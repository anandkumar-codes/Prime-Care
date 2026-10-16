package com.primecare.hms;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Sends a file straight into a WhatsApp chat with a given number, skipping the share sheet and
 * the contact picker. WhatsApp still shows the message with a Send button: apps cannot send
 * WhatsApp messages silently without the WhatsApp Business API.
 * JS: Capacitor.Plugins.PrimeWhatsApp.sendFile({ path, phone, text }) · isInstalled()
 */
@CapacitorPlugin(name = "PrimeWhatsApp")
public class WhatsAppPlugin extends Plugin {

    private static final String[] PACKAGES = { "com.whatsapp", "com.whatsapp.w4b" };

    private String installedPackage() {
        PackageManager pm = getContext().getPackageManager();
        for (String p : PACKAGES) {
            try { pm.getPackageInfo(p, 0); return p; } catch (PackageManager.NameNotFoundException ignored) { }
        }
        return null;
    }

    @PluginMethod
    public void isInstalled(PluginCall call) {
        String pkg = installedPackage();
        JSObject r = new JSObject();
        r.put("installed", pkg != null);
        r.put("app", pkg == null ? "" : pkg);
        call.resolve(r);
    }

    @PluginMethod
    public void sendFile(PluginCall call) {
        String path = call.getString("path", "");
        String phone = call.getString("phone", "").replaceAll("\\D", "");
        String text = call.getString("text", "");
        String pkg = installedPackage();
        if (pkg == null) { call.reject("WhatsApp is not installed on this phone", "NOT_INSTALLED"); return; }
        try {
            File file = new File(Uri.parse(path).getPath());
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("application/pdf");
            i.setPackage(pkg);
            i.putExtra(Intent.EXTRA_STREAM, uri);
            if (!text.isEmpty()) i.putExtra(Intent.EXTRA_TEXT, text);
            // Opens the chat with this number directly instead of the contact picker
            if (!phone.isEmpty()) i.putExtra("jid", phone + "@s.whatsapp.net");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
            JSObject r = new JSObject();
            r.put("app", pkg);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not open WhatsApp: " + e.getMessage(), "FAILED");
        }
    }
}
