package com.primecare.hms;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Fingerprint / face unlock for Prime Care, using the system BiometricPrompt.
 * JS: Capacitor.Plugins.PrimeBiometric.isAvailable() and .authenticate({ title, subtitle, negative }).
 */
@CapacitorPlugin(name = "PrimeBiometric")
public class BiometricPlugin extends Plugin {

    private static final int AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_WEAK;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        int status = BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS);
        String reason;
        switch (status) {
            case BiometricManager.BIOMETRIC_SUCCESS: reason = "ok"; break;
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED: reason = "none_enrolled"; break;
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE: reason = "no_hardware"; break;
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE: reason = "unavailable"; break;
            case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED: reason = "update_required"; break;
            default: reason = "unsupported";
        }
        JSObject result = new JSObject();
        result.put("available", status == BiometricManager.BIOMETRIC_SUCCESS);
        result.put("reason", reason);
        call.resolve(result);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        String title = call.getString("title", "Unlock Prime Care");
        String subtitle = call.getString("subtitle", "Use your fingerprint");
        String negative = call.getString("negative", "Cancel");

        getActivity().runOnUiThread(() -> {
            BiometricPrompt prompt = new BiometricPrompt(
                (FragmentActivity) getActivity(),
                ContextCompat.getMainExecutor(getContext()),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        JSObject ok = new JSObject();
                        ok.put("verified", true);
                        call.resolve(ok);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        // Cancelled, too many attempts, or the user chose the negative button
                        call.reject(errString.toString(), String.valueOf(errorCode));
                    }
                    // onAuthenticationFailed (finger not recognised) keeps the prompt open, so nothing to do
                });

            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setNegativeButtonText(negative)
                .setAllowedAuthenticators(AUTHENTICATORS)
                .setConfirmationRequired(false)
                .build();
            prompt.authenticate(info);
        });
    }
}
