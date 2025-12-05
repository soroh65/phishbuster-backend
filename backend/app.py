from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os

app = Flask(__name__)
CORS(app)

# ---------------------------------------
# HOME ROUTE (fixes Railway 404 error)
# ---------------------------------------
@app.route("/", methods=["GET"])
def home():
    return {"message": "PhishBuster backend is running!"}


# ---------------------------------------
# LOAD MODEL SAFELY
# ---------------------------------------
try:
    MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
    print("MODEL PATH:", MODEL_PATH)

    model = joblib.load(MODEL_PATH)
    print("MODEL LOADED SUCCESSFULLY")

except Exception as e:
    print("FAILED TO LOAD MODEL:", str(e))
    model = None


# ---------------------------------------
# PREDICT ENDPOINT
# ---------------------------------------
@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"error": "Model not loaded on server"}), 500

    data = request.json.get("text", "")
    if not data:
        return jsonify({"error": "No text provided"}), 400

    try:
        prediction = model.predict([data])[0]
        return jsonify({"prediction": prediction})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --------------------------------------
# RUN LOCALLY (Railway uses Gunicorn)
# --------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)