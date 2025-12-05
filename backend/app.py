from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib

app = Flask(__name__)
CORS(app)

MODEL_PATH = "model.pkl"

# -----------------------
# Load the ML model safely
# -----------------------
try:
    model = joblib.load(MODEL_PATH)
    print("MODEL LOADED SUCCESSFULLY")
except Exception as e:
    print("FAILED TO LOAD MODEL:", str(e))
    model = None



# -----------------------
# Prediction Route
# -----------------------
@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"error": "Model not loaded"}), 500

    data = request.get_json()
    text = data.get("text", "")

    try:
        prediction = model.predict([text])[0]
        return jsonify({"prediction": prediction})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------
# Start Flask Server
# -----------------------
import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

