# Qwen Multi-Angle Camera Control

A modern web app for controlling camera angles on images using the Qwen Image Edit model with the Multi-Angles LoRA via the fal.ai API.

![Preview](https://img.shields.io/badge/Three.js-black?style=flat&logo=three.js&logoColor=white)
![fal.ai](https://img.shields.io/badge/fal.ai-API-blue)

## Screenshot

![Qwen Multi-Angle App](qwenmultiangle.png)

## Features

- 🎮 **3D Camera Control** - Interactive Three.js viewport with draggable handles for azimuth, elevation, and distance
- 🎚️ **Slider Controls** - Manual control via intuitive sliders
- 🖼️ **Real-time Preview** - See your uploaded image in the 3D scene
- ⚡ **Fast Generation** - Powered by fal.ai's infrastructure
- 📱 **Responsive** - Works on desktop and mobile

## Credits & Inspiration

Inspired by [multimodalart/qwen-image-multiple-angles-3d-camera](https://huggingface.co/spaces/multimodalart/qwen-image-multiple-angles-3d-camera) on Hugging Face Spaces.

Powered by [fal.ai - Qwen Image Edit 2511 Multiple Angles](https://fal.ai/models/fal-ai/qwen-image-edit-2511-multiple-angles/)

## Getting Started

### Prerequisites

- Node.js 18+ (for local development/deployment)
- A fal.ai API key - [Get your key here](https://fal.ai/dashboard/keys)

### Local Development

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd qwenmultiangle
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open http://localhost:3000 in your browser

5. Enter your fal.ai API key in the app

### Deploy to Railway

1. Push this code to a GitHub repository

2. Go to [Railway](https://railway.app) and create a new project

3. Select "Deploy from GitHub repo"

4. Select your repository

5. Railway will automatically detect the Node.js app and deploy it

6. Your app will be live at the provided Railway URL!

## Project Structure

```
qwenmultiangle/
├── index.html      # Main HTML structure
├── style.css       # Modern dark theme styling
├── app.js          # Three.js scene + fal.ai API integration
├── server.js       # Express server for static file serving
├── package.json    # Node.js dependencies
└── README.md       # This file
```

## Camera Controls

| Control | Range | Description |
|---------|-------|-------------|
| **Azimuth** | 0° - 315° | Horizontal rotation (front, right, back, left) |
| **Elevation** | -30° - 60° | Vertical angle (low, eye-level, high) |
| **Distance** | 0.6 - 1.8 | Camera distance (close-up, medium, wide) |

## Prompt Format

The app generates prompts in the format:
```
<sks> [azimuth view] [elevation shot] [distance shot]
```

Example: `<sks> front-right quarter view elevated shot close-up`

## License

MIT

---

Powered by [fal.ai](https://fal.ai/models/fal-ai/qwen-image-edit-2511-multiple-angles/)

