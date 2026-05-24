# The River

Overview
--------
This project implements an AI that learns to play poker and improves over time through experience. It also includes a multiplayer mode so you can play with friends.

Key features
------------
- Reinforcement learning-based agent that self-adapts to opponents and player styles
- Single-player training against simulated opponents
- Multiplayer mode for playing with friends
- Modular design to experiment with different learning algorithms and environments

Getting started
---------------
1. Clone the repository
2. Create a virtual environment and install dependencies (see requirements.txt)
3. Run training scripts to train the agent or start the multiplayer server to play

Basic usage
-----------
- Training: python train.py --config configs/default.yml
- Play locally: python play.py --mode local
- Start multiplayer server: python server.py --port 8000

Contributing
------------
Contributions, bug reports, and feature requests are welcome. Please open an issue or submit a pull request.

License
-------
Specify a license for the project (e.g., MIT) in a LICENSE file.

Notes
-----
Corrected typos and clarified project description. Update the commands and filenames above to match your repository structure.

Deployment (quick)
------------------
Frontend on Vercel:
- Connect this GitHub repository to Vercel and deploy the project. In the Vercel dashboard set an environment variable `VITE_API_BASE` to your backend HTTPS URL (for example `https://api.example.com`).

Backend (example hosts):
- Use Railway, Render, or AWS App Runner / Elastic Beanstalk to host the FastAPI backend. Ensure you set `DATABASE_URL` for Postgres and `CORS_ORIGINS` to your frontend origin (e.g. `https://your-site.vercel.app`).

Notes:
- The frontend reads `VITE_API_BASE` at build time to connect to the API and will automatically use `wss://` for secure WebSockets when the API URL is HTTPS.
- Keep secrets out of the repo; use the host's environment variables for production values.

If you want, I can patch the repo to add a simple GitHub Actions workflow to deploy the backend to AWS or provide step-by-step console instructions for AWS services.