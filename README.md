# Tolga Aydın Portfolio

A modern, responsive portfolio website built with HTML, CSS, JavaScript, and Node.js.

## Features

- 🎨 Dark / Light Mode Toggle
- 📱 Fully Responsive Design
- 📧 Contact Form with Email Integration
- 🖼️ Smooth Reveal Animations
- 🎯 Interactive Hero Section with Canvas
- 🏃‍♂️ Marquee Section with Pause-on-Hover
- 📊 Capabilities and Process Sections
- 📁 Selected Works Gallery

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript, Three.js
- **Backend**: Node.js, Express.js
- **Email**: Nodemailer
- **Build Tool**: Vite

## Installation & Development

1. Clone the repository:
```bash
git clone https://github.com/tugipasha/Blog.git
cd Blog
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

5. Start production server:
```bash
npm start
```

## Project Structure

```
Blog/
├── public/              # Static assets
├── index.html           # Main HTML file
├── styles.css           # Global styles
├── script.js            # Frontend JavaScript
├── shaders.js           # Three.js shaders
├── server.js            # Express backend server
├── package.json         # Project dependencies
└── README.md            # This file
```

## Contact Form

The contact form sends emails using Nodemailer and Gmail SMTP. It includes:
- Client-side validation
- Honeypot field for spam protection
- Server-side rate limiting
- Success/Error messages with animations

## Author

Tolga Aydın
