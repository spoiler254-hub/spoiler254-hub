from flask import Flask, jsonify, request
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore

app = Flask(__name__)
CORS(app)

# Initialize Firebase
cred = credentials.Certificate("path/to/serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

@app.route('/api/moments', methods=['GET'])
def get_moments():
    try:
        docs = db.collection('moments').stream()
        return jsonify([doc.to_dict() for doc in docs])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete-moment', methods=['POST'])
def delete_moment():
    moment_id = request.json.get('moment_id')
    try:
        db.collection('moments').document(moment_id).delete()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
