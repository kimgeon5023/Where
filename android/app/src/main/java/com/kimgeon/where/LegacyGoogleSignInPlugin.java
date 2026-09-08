package com.kimgeon.where;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "LegacyGoogleSignIn")
public class LegacyGoogleSignInPlugin extends Plugin {
    private GoogleSignInClient client;

    @PluginMethod
    public void signIn(PluginCall call) {
        String clientId = call.getString("clientId");
        if (clientId == null || clientId.isBlank()) {
            call.reject("Google Web client ID is missing.", "MISSING_CLIENT_ID");
            return;
        }

        GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestProfile()
            .requestIdToken(clientId)
            .build();
        client = GoogleSignIn.getClient(getActivity(), options);
        startActivityForResult(call, client.getSignInIntent(), "handleSignInResult");
    }

    @ActivityCallback
    private void handleSignInResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;
        Intent data = activityResult.getData();
        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            String idToken = account.getIdToken();
            if (idToken == null || idToken.isBlank()) {
                call.reject("Google did not return an ID token.", "MISSING_ID_TOKEN");
                return;
            }
            JSObject result = new JSObject();
            result.put("idToken", idToken);
            call.resolve(result);
        } catch (ApiException error) {
            call.reject("Google sign-in failed (status " + error.getStatusCode() + ").", "GOOGLE_STATUS_" + error.getStatusCode(), error);
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        if (client == null) {
            call.resolve();
            return;
        }
        client.signOut()
            .addOnSuccessListener(unused -> call.resolve())
            .addOnFailureListener(error -> call.reject("Google sign-out failed.", error));
    }
}
