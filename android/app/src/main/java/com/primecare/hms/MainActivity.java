package com.primecare.hms;

import android.os.Bundle;

import androidx.work.WorkManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // In-app native plugins must be registered before the bridge starts
        registerPlugin(BiometricPlugin.class);
        registerPlugin(WhatsAppPlugin.class);
        super.onCreate(savedInstanceState);
        // Data is now kept on the Prime Care server, so the nightly on-phone backup
        // scheduled by earlier versions is no longer needed
        WorkManager.getInstance(this).cancelUniqueWork("prime-daily-backup");
    }
}
