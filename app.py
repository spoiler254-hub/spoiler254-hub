# app.py
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
import firebase_admin
from firebase_admin import credentials, firestore, auth, functions
import os
import datetime # Using datetime for timestamps as moment.js is JS-specific

# --- Firebase Admin SDK Initialization ---
# IMPORTANT: Replace 'path/to/your/serviceAccountKey.json' with the actual path
# to your Firebase Admin SDK service account key file.
# You can generate this from Firebase Console -> Project settings -> Service accounts.
try:
    cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'path/to/your/serviceAccountKey.json')
    if not os.path.exists(cred_path):
        raise FileNotFoundError(f"Service account key file not found at: {cred_path}")
    
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    print("Firebase Admin SDK initialized successfully.")
except Exception as e:
    print(f"Error initializing Firebase Admin SDK: {e}")
    # Exit or handle gracefully if Firebase init fails
    # sys.exit(1) # Uncomment if you want the app to exit on init failure

db = firestore.client()
# auth_client = auth.Client(app) # If you need auth-specific operations beyond basic admin claims
# functions_client = functions.Client(app) # If you need to call cloud functions from backend

app = Flask(__name__)
app.secret_key = 'your_super_secret_key' # Needed for flash messages

# --- Configuration for Admin UIDs ---
# In a real app, this might come from environment variables or a config file
ADMIN_UIDS = os.environ.get('ADMIN_UIDS', 'admin_user_uid_1,admin_user_uid_2').split(',')

# --- Middleware for Admin Check (simplified) ---
# In a real app, you'd verify a user's session token here
# For this example, we'll simulate a login check in dashboard route
def is_admin(user_id):
    # In a real Flask app, you'd verify the user's Firebase ID token
    # and then check custom claims or a flag in Firestore.
    # For this simplified example, we're just checking against a hardcoded list.
    return user_id in ADMIN_UIDS

# --- Routes ---

@app.route('/')
def index():
    # Simulate a login page or redirect to dashboard if already "logged in"
    return render_template('login.html') # You'd create a login.html

@app.route('/login', methods=['POST'])
def login():
    # Simplified login: In a real app, you'd verify credentials with Firebase Auth
    # and create a session. Here, we just check a dummy UID.
    dummy_uid = request.form.get('uid') # Simulate UID input for testing
    if dummy_uid and is_admin(dummy_uid):
        # In a real app, you'd store this UID in a Flask session
        # session['user_id'] = dummy_uid
        flash('Logged in as Admin (simulated)!', 'success')
        return redirect(url_for('admin_dashboard', user_id=dummy_uid)) # Pass UID for demo
    else:
        flash('Access Denied: Invalid UID or not an Admin.', 'error')
        return redirect(url_for('index'))


@app.route('/admin')
def admin_dashboard():
    # Simulate admin check. In a real app, this would be based on session.
    simulated_admin_uid = request.args.get('user_id') # From login redirect
    if not simulated_admin_uid or not is_admin(simulated_admin_uid):
        flash('Access denied. Admins only.', 'error')
        return redirect(url_for('index'))

    # --- Fetch Users ---
    users_ref = db.collection('users').stream()
    users = []
    for user_doc in users_ref:
        user_data = user_doc.to_dict()
        user_data['id'] = user_doc.id
        # Convert Firebase timestamp to readable string if needed
        if 'creationTime' in user_data.get('metadata', {}):
            try:
                # Firebase timestamp might be a string or a Firestore Timestamp object
                if isinstance(user_data['metadata']['creationTime'], str):
                    users.append(user_data)
                elif hasattr(user_data['metadata']['creationTime'], 'nanoseconds'): # Firestore Timestamp
                     users.append(user_data)
                else: # Assume epoch milliseconds if not string or Timestamp
                     dt_object = datetime.datetime.fromtimestamp(user_data['metadata']['creationTime'] / 1000.0)
                     user_data['metadata']['creationTime_formatted'] = dt_object.strftime("%b %d,%Y")
                     users.append(user_data)
            except Exception as e:
                print(f"Error processing user creationTime: {e}")
                users.append(user_data) # Add anyway, maybe without formatted time
        else:
            users.append(user_data)
        
    # --- Fetch Moments (basic pagination) ---
    page = int(request.args.get('page', 1))
    items_per_page = 10
    moments = []
    total_moments_count = 0
    has_more = False

    try:
        # Get total count (using aggregation query)
        count_query = db.collection('moments').count()
        total_moments_snapshot = count_query.get()
        total_moments_count = total_moments_snapshot.to_dict()['count']

        # Moments query with pagination
        moments_query = db.collection('moments').order_by('timestamp', direction=firestore.Query.DESCENDING) \
                           .limit(items_per_page + 1) # Fetch one more to check if has_more

        # Implement startAfter if needed (more complex with server-side pagination without client-side state)
        # For simple page numbers, you'd typically use an offset, but Firestore prefers cursors.
        # A true server-side cursor pagination is more involved. For this example, we'll do a basic skip.
        # This is a simplification and not how Firestore pagination with cursors ideally works.
        offset = (page - 1) * items_per_page
        if offset > 0:
            # Firestore doesn't have a direct 'offset'. You'd typically use `start_after` with a document snapshot.
            # To simulate for a simple page number, you'd fetch all up to the offset, then the next page.
            # This is inefficient for large datasets.
            # A more robust solution involves passing the last document ID from the previous page to the server.
            pass # Skipping complex server-side cursor pagination for this basic example

        moments_snapshot = moments_query.stream()
        
        fetched_moments = []
        for doc in moments_snapshot:
            moment_data = doc.to_dict()
            moment_data['id'] = doc.id
            # Convert Firestore Timestamp to Python datetime, then format
            if 'timestamp' in moment_data and isinstance(moment_data['timestamp'], firestore.Timestamp):
                moment_data['timestamp_formatted'] = moment_data['timestamp'].to_datetime().strftime("%b %d,%Y %I:%M %p")
            else:
                moment_data['timestamp_formatted'] = "N/A" # Fallback
            fetched_moments.append(moment_data)
        
        if len(fetched_moments) > items_per_page:
            has_more = True
            moments = fetched_moments[:items_per_page]
        else:
            moments = fetched_moments

    except Exception as e:
        print(f"Error fetching moments: {e}")
        flash('Failed to fetch moments.', 'error')

    return render_template(
        'dashboard.html',
        users=users,
        moments=moments,
        total_moments_count=total_moments_count,
        current_page=page,
        has_more=has_more,
        # Pass the current admin's UID for chat button logic
        current_admin_uid=simulated_admin_uid
    )

@app.route('/delete_moment/<moment_id>', methods=['POST'])
def delete_moment(moment_id):
    # In a real app, ensure this action is authorized (e.g., admin check)
    simulated_admin_uid = request.form.get('admin_uid') # From hidden input in form
    if not simulated_admin_uid or not is_admin(simulated_admin_uid):
        flash('Access denied. Admins only.', 'error')
        return redirect(url_for('index'))

    try:
        db.collection('moments').document(moment_id).delete()
        flash(f'Moment {moment_id} deleted successfully!', 'success')
    except Exception as e:
        print(f"Error deleting moment: {e}")
        flash('Failed to delete moment.', 'error')
    return redirect(url_for('admin_dashboard', user_id=simulated_admin_uid)) # Pass UID back

@app.route('/ban_user/<user_id>', methods=['POST'])
def ban_user(user_id):
    # In a real app, ensure this action is authorized (e.g., admin check)
    simulated_admin_uid = request.form.get('admin_uid') # From hidden input in form
    if not simulated_admin_uid or not is_admin(simulated_admin_uid):
        flash('Access denied. Admins only.', 'error')
        return redirect(url_for('index'))

    try:
        # This part requires Firebase Authentication Admin SDK
        # Example: Disable user and revoke tokens
        auth.update_user(user_id, disabled=True)
        auth.revoke_refresh_tokens(user_id)

        # Optional: Update Firestore user document
        db.collection('users').document(user_id).update({
            'isBanned': True,
            'bannedAt': firestore.SERVER_TIMESTAMP,
            'bannedBy': simulated_admin_uid
        })
        flash(f'User {user_id} banned successfully!', 'success')
    except firebase_admin.auth.AuthError as e:
        flash(f'Firebase Auth Error banning user: {e.code} - {e.message}', 'error')
    except Exception as e:
        print(f"Error banning user: {e}")
        flash('Failed to ban user.', 'error')
    return redirect(url_for('admin_dashboard', user_id=simulated_admin_uid)) # Pass UID back

@app.route('/get_chat/<target_user_id>')
def get_chat(target_user_id):
    # This route would be called via AJAX from the frontend
    # In a real app, perform admin authentication here as well
    admin_uid = request.args.get('admin_uid')
    if not admin_uid or not is_admin(admin_uid):
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        members = sorted([admin_uid, target_user_id])
        chat_query = db.collection('chats').where('members', '==', members).limit(1).stream()
        
        chat_id = None
        for doc in chat_query:
            chat_id = doc.id
            break
        
        if not chat_id:
            # Create new chat if not found
            chat_ref = db.collection('chats').add({
                'members': members,
                'createdAt': firestore.SERVER_TIMESTAMP
            })
            chat_id = chat_ref[1].id # chat_ref is a tuple (doc_ref, doc_snapshot)

        messages = []
        messages_query = db.collection('chats').document(chat_id).collection('messages').order_by('createdAt', direction=firestore.Query.ASCENDING).stream()
        for msg_doc in messages_query:
            msg_data = msg_doc.to_dict()
            msg_data['id'] = msg_doc.id
            if 'createdAt' in msg_data and isinstance(msg_data['createdAt'], firestore.Timestamp):
                msg_data['createdAt'] = msg_data['createdAt'].to_datetime().strftime("%H:%M")
            messages.append(msg_data)

        # Fetch target user info
        target_user_doc = db.collection('users').document(target_user_id).get()
        target_user_name = target_user_doc.to_dict().get('displayName', target_user_doc.to_dict().get('email', 'Unknown User')) if target_user_doc.exists else 'Unknown User'

        return jsonify({
            'chatId': chat_id,
            'messages': messages,
            'targetUserName': target_user_name,
            'adminUid': admin_uid # Pass adminUid back for message rendering logic
        })
    except Exception as e:
        print(f"Error fetching chat: {e}")  # Log the exception details on the server
        return jsonify({'error': 'An internal error occurred while fetching the chat.'}), 500

@app.route('/send_message/<chat_id>', methods=['POST'])
def send_message(chat_id):
    # This route would be called via AJAX from the frontend
    # In a real app, perform admin authentication here as well
    data = request.get_json()
    message_text = data.get('text')
    admin_uid = data.get('adminUid')
    admin_email = data.get('adminEmail') # Passed from client for display

    if not message_text or not chat_id or not admin_uid or not is_admin(admin_uid):
        return jsonify({'error': 'Invalid request data or unauthorized'}), 400

    try:
        db.collection('chats').document(chat_id).collection('messages').add({
            'text': message_text,
            'senderId': admin_uid,
            'senderEmail': admin_email,
            'createdAt': firestore.SERVER_TIMESTAMP
        })
        return jsonify({'success': True, 'message': 'Message sent!'}), 200
    except Exception as e:
        print(f"Error sending message: {e}")  # Log the exception details on the server
        return jsonify({'error': 'An internal error occurred while sending the message.'}), 500


if __name__ == '__main__':
    app.run(debug=True) # Set debug=False in production
              
