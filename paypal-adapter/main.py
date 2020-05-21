from flask import Flask, request, jsonify
import os
import json
import math
from paypalpayoutssdk.core import PayPalHttpClient, SandboxEnvironment, LiveEnvironment
from paypalpayoutssdk.payouts import PayoutsGetRequest, PayoutsPostRequest
from paypalhttp import HttpError

from dotenv import load_dotenv
load_dotenv(verbose=True)

client_id = os.environ["PAYPAL-CLIENT-ID"] if 'PAYPAL-CLIENT-ID' in os.environ else "PAYPAL-CLIENT-ID"
client_secret = os.environ["PAYPAL-CLIENT-SECRET"] if 'PAYPAL-CLIENT-SECRET' in os.environ else "PAYPAL-CLIENT-SECRET"
environment = SandboxEnvironment(client_id=client_id, client_secret=client_secret)
client = PayPalHttpClient(environment)

# If `entrypoint` is not defined in app.yaml, App Engine will look for an app
# called `app` in `main.py`.
app = Flask(__name__)

@app.route('/payout/<string:payout_id>')
def get_payout(payout_id):
    request = PayoutsGetRequest(payout_id)
    try:
        print(f"payout id requested: {payout_id}")
        response = client.execute(request)
        return jsonify(response.result.dict())
    except IOError as ioe:
        if isinstance(ioe, HttpError):
            print(ioe.status_code)
            print(ioe.headers)
            print(ioe)
        else:
            print(ioe)
        return "Server Error"

@app.route('/payout', methods=['POST'])
def post_payout():
    data = request.json
    print(f"Incoming data: {data}")
    job_id = data['id']
    trx_hash = data['meta']['initiator']['transactionHash']
    body = json.loads(data['data']['body'])
    eth_value = float(body['value']) / math.pow(10.0, 18)
    receiver = body['receiver_email']

    # find out the eth_value to USD conversion in order to pay the correct amount out
    # usd_value = 0.0

    # Construct a request object and set desired parameters
    # Here, PayoutsPostRequest()() creates a POST request to /v1/payments/payouts
    body = {
        "sender_batch_header": {
            "recipient_type": "EMAIL",
            "email_message": "Payout Test",
            "note": "Enjoy your Payout!",
            "sender_batch_id": f"{trx_hash}",
            "email_subject": f"Payout trx: {trx_hash}"
        },
        "items": [{
            "note": f"{trx_hash}",
            "amount": {
                "currency": "USD",
                "value": f"{eth_value}"
            },
            "receiver": f"{receiver}",
            "sender_item_id": f"{job_id}"
        }]
    }
    print(f"Payout request: {body}")
    paypal_request = PayoutsPostRequest()
    paypal_request.request_body(body)

    try:
        # Call API with your client and get a response for your call
        response = client.execute(paypal_request)
        print(response)
        return_data = {
            "jobRunID": job_id,
            "status": str(response.status_code)
        }
        print(f"Return data: {return_data}")
        return jsonify(return_data)
    except IOError as ioe:
        print(ioe)
        return_data = {
            "jobRunID": job_id,
            "status": str(ioe.status_code)
        }
        print(f"Return data: {return_data}")
        return jsonify(return_data)

if __name__ == '__main__':
    # This is used when running locally only. When deploying to Google App
    # Engine, a webserver process such as Gunicorn will serve the app. This
    # can be configured by adding an `entrypoint` to app.yaml.
    app.run(host='127.0.0.1', port=8080, debug=True)
