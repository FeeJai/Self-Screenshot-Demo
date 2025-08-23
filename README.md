# Self Screenshot Demo

A static HTML page that can take screenshots of itself using modern browser APIs.

## Features

- 🎥 **Initialize Media First**: Start screen capture before taking screenshots
- ⚡ **Instant Capture**: Take screenshots immediately on button click with no delay
- 📁 **Auto-Download**: Screenshots are automatically saved as PNG files
- ⌨️ **Keyboard Shortcuts**: 
  - `Ctrl/Cmd + S`: Take screenshot (when capturing)
  - `Ctrl/Cmd + Q`: Stop capture
- 🖼️ **Live Preview**: View captured screenshots directly on the page
- 📱 **Responsive Design**: Works on desktop and mobile browsers

## How to Use

1. **Open the Demo**: Open `index.html` in a modern web browser
2. **Start Capture**: Click "🎥 Start Capture" - your browser will ask for screen sharing permission
3. **Take Screenshots**: Click "📸 Take Screenshot" or press `Ctrl/Cmd + S` to capture instantly
4. **Download**: Screenshots are automatically downloaded as PNG files
5. **Stop Capture**: Click "⏹️ Stop Capture" when finished

## Browser Requirements

- Chrome 72+
- Firefox 66+
- Safari 13+
- Edge 79+

The app uses the Screen Capture API (`getDisplayMedia`) which requires HTTPS in production or localhost for development.

## Files

- `index.html` - Main HTML page with styling and structure
- `screenshot.js` - JavaScript implementation using Screen Capture API

## Technical Details

This implementation follows the methodology of modern screenshot libraries by:

1. **Pre-initializing Media**: Uses `navigator.mediaDevices.getDisplayMedia()` to start screen capture first
2. **Real-time Capture**: Draws video frames to canvas for immediate screenshot capture
3. **Optimized Settings**: Configures video stream for optimal quality (1920x1080, 30-60fps)
4. **Error Handling**: Comprehensive error handling for different browser scenarios
5. **Memory Management**: Proper cleanup of media streams and blob URLs

## Security Notes

- Screen Capture API requires user permission
- Only works on HTTPS or localhost
- No data is sent to external servers - everything runs locally

## License

MIT License - Feel free to use and modify as needed.
