from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os

app = Flask(__name__)
CORS(app)

# -------------------------------
# Load the ML model safely
# -------------------------------
try:
    MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
    model = joblib.load(MODEL_PATH)
    print("MODEL LOADED SUCCESSFULLY")
except Exception as e:
    print("FAILED TO LOAD MODEL:", str(e))
    model = None


# -------------------------------
# API ROUTES
# -------------------------------

@app.route("/")
def home():
    return jsonify({"message": "PhishBuster backend is running!"})


@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"error": "MODEL NOT LOADED"}), 500

    data = request.get_json()

    if not data or "text" not in data:
        return jsonify({"error": "Missing 'text' field"}), 400

    email_text = data["text"]

    try:
        prediction = model.predict([email_text])[0]
        return jsonify({"prediction": prediction})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------------------------------
# Run the app
# -------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)