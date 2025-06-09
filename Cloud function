// functions/index.js (Firebase Cloud Functions)
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.banUser = functions.https.onCall(async (data, context) => {
  // Check if the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  // Check if the authenticated user is an admin (e.g., using custom claims)
  // This is crucial for security! Adapt to your admin check method.
  // For this example, we assume custom claims are set for admins.
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can perform this action.'
    );
  }

  const userIdToBan = data.userId;

  if (!userIdToBan) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The `userId` is required.'
    );
  }

  try {
    // 1. Disable the user account
    await admin.auth().updateUser(userIdToBan, { disabled: true });

    // 2. Revoke all refresh tokens (forces user to log out)
    await admin.auth().revokeRefreshTokens(userIdToBan);

    // Optional: Update a 'banned' status in Firestore user document
    await admin.firestore().collection('users').doc(userIdToBan).update({
      isBanned: true,
      bannedAt: admin.firestore.FieldValue.serverTimestamp(),
      bannedBy: context.auth.uid, // Record which admin banned them
    });

    console.log(`User ${userIdToBan} has been banned by admin ${context.auth.uid}`);

    return { success: true, message: `User ${userIdToBan} banned and logged out successfully.` };
  } catch (error) {
    console.error("Error banning user:", error);
    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError('not-found', 'User not found.');
    }
    throw new functions.https.HttpsError(
      'internal',
      `Failed to ban user: ${error.message}`,
      error
    );
  }
});
