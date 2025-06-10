# api.py
from flask import Flask, jsonify, request
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Initialize Firebase
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# --- USERS ---

@app.route('/api/users', methods=['GET'])
def get_users():
    try:
        users_ref = db.collection('users')
        docs = users_ref.stream()
        users = [{"id": doc.id, **doc.to_dict()} for doc in docs]
        return jsonify(users)
    except Exception as e:
        print(e)  # Log error
        return jsonify({"error": str(e)}), 500

@app.route('/api/ban-user', methods=['POST'])
def ban_user():
    user_id = request.json.get('userId')
    if not user_id:
        return jsonify({"error": "No userId provided"}), 400
    try:
        db.collection('users').document(user_id).update({'banned': True})
        return jsonify({"success": True, "message": "User banned."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# --- MOMENTS ---

@app.route('/api/moments', methods=['GET'])
def get_moments():
    search = request.args.get('search', '').lower()
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    moments_ref = db.collection('moments').order_by('timestamp', direction=firestore.Query.DESCENDING)
    docs = moments_ref.stream()
    moments = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        if search and search not in (data.get('caption') or '').lower():
            continue
        moments.append(data)
    total = len(moments)
    start = (page - 1) * per_page
    end = start + per_page
    paged = moments[start:end]
    return jsonify({
        "moments": paged,
        "total": total,
        "has_more": end < total
    })

@app.route('/api/delete-moment', methods=['POST'])
def delete_moment():
    moment_id = request.json.get('id')
    if not moment_id:
        return jsonify({"error": "No moment ID provided"}), 400
    try:
        db.collection('moments').document(moment_id).delete()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- STATISTICS ---

@app.route('/api/stats', methods=['GET'])
def get_stats():
    users_ref = db.collection('users')
    moments_ref = db.collection('moments')
    users = [doc.to_dict() for doc in users_ref.stream()]
    moments = [doc.to_dict() for doc in moments_ref.stream()]
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=today.weekday())
    active_today = sum(
        1 for u in users
        if u.get('metadata', {}).get('lastSignInTime') and
        datetime.fromisoformat(u['metadata']['lastSignInTime']) >= today
    )
    new_this_week = sum(
        1 for u in users
        if u.get('metadata', {}).get('creationTime') and
        datetime.fromisoformat(u['metadata']['creationTime']) >= week_start
    )
    return jsonify({
        "total_users": len(users),
        "total_moments": len(moments),
        "active_today": active_today,
        "new_this_week": new_this_week
    })

# --- CHAT (basic) ---

@app.route('/api/chats', methods=['GET'])
def get_chats():
    user_id = request.args.get('userId')
    if not user_id:
        return jsonify({"error": "No userId provided"}), 400
    chats_ref = db.collection('chats').where('members', 'array_contains', user_id)
    docs = chats_ref.stream()
    chats = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        chats.append(data)
    return jsonify(chats)

@app.route('/api/chat-messages', methods=['GET'])
def get_chat_messages():
    chat_id = request.args.get('chatId')
    if not chat_id:
        return jsonify({"error": "No chatId provided"}), 400
    messages_ref = db.collection('chats').document(chat_id).collection('messages').order_by('timestamp')
    docs = messages_ref.stream()
    messages = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        messages.append(data)
    return jsonify(messages)

@app.route('/api/send-message', methods=['POST'])
def send_message():
    chat_id = request.json.get('chatId')
    user_id = request.json.get('userId')
    content = request.json.get('content')
    if not chat_id or not user_id or not content:
        return jsonify({"error": "Missing data"}), 400
    try:
        message = {
            'userId': user_id,
            'content': content,
            'timestamp': firestore.SERVER_TIMESTAMP
        }
        db.collection('chats').document(chat_id).collection('messages').add(message)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)
