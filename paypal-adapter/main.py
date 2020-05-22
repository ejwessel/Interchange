from flask import Flask, request, jsonify
import os
import json
import math
from requests import Request, Session
from requests.exceptions import ConnectionError, Timeout, TooManyRedirects
from paypalpayoutssdk.core import PayPalHttpClient, SandboxEnvironment, LiveEnvironment
from paypalpayoutssdk.payouts import PayoutsGetRequest, PayoutsPostRequest
from paypalhttp import HttpError

from dotenv import load_dotenv
load_dotenv(verbose=True)

if 'DEVELOPMENT' in os.environ and bool(os.environ['DEVELOPMENT']):
    print("Development Mode")
    CLIENT_ID = os.environ["PAYPAL-CLIENT-ID"] if 'PAYPAL-CLIENT-ID' in os.environ else "PAYPAL-CLIENT-ID"
    CLIENT_SECRET = os.environ["PAYPAL-CLIENT-SECRET"] if 'PAYPAL-CLIENT-SECRET' in os.environ else "PAYPAL-CLIENT-SECRET"
    CMC_KEY = os.environ["X-CMC_SANDBOX_API_KEY"] if 'X-CMC_SANDBOX_API_KEY' in os.environ else "X-CMC_SANDBOX_API_KEY"
    CMC_URL = os.environ["CMC_SANDBOX_URL"] if 'CMC_SANDBOX_URL' in os.environ else "CMC_SANDBOX_URL"
    environment = SandboxEnvironment(client_id=CLIENT_ID, client_secret=CLIENT_SECRET)
else:
    print("Live Mode")
    CLIENT_ID = os.environ["PAYPAL-CLIENT-ID"] if 'PAYPAL-CLIENT-ID' in os.environ else "PAYPAL-CLIENT-ID"
    CLIENT_SECRET = os.environ["PAYPAL-CLIENT-SECRET"] if 'PAYPAL-CLIENT-SECRET' in os.environ else "PAYPAL-CLIENT-SECRET"
    CMC_KEY = os.environ["X-CMC_PRO_API_KEY"] if 'X-CMC_PRO_API_KEY' in os.environ else "X-CMC_PRO_API_KEY"
    CMC_URL = os.environ["CMC_URL"] if 'CMC_URL' in os.environ else "CMC_URL"
    # TODO: ADD LIVE ENVIRONMENT HERE
    # environment = SandboxEnvironment(client_id=CLIENT_ID, client_secret=CLIENT_SECRET)

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

    usd_value = fetch_eth_usd_rate() * eth_value

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
                "value": f"{usd_value:.2f}"
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


def fetch_eth_usd_rate():
    headers = {
        'Accepts': 'application/json',
        'X-CMC_PRO_API_KEY': CMC_KEY,
    }
    session = Session()
    session.headers.update(headers)

    try:
        response = session.get(CMC_URL)
        data = json.loads(response.text)
        print(f"CMC data: {data}")
        price = data['data']['ETH']['quote']['USD']['price']
        return price
    except (ConnectionError, Timeout, TooManyRedirects) as e:
        print(f'Problem fetching ETH/USD Value {e}')
        return 0

if __name__ == '__main__':
    # This is used when running locally only. When deploying to Google App
    # Engine, a webserver process such as Gunicorn will serve the app. This
    # can be configured by adding an `entrypoint` to app.yaml.
    app.run(host='127.0.0.1', port=8080, debug=True)
