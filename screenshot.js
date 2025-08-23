class ScreenshotCapture {
    constructor() {
        this.mediaStream = null;
        this.videoElement = null;
        this.isCapturing = false;
        this.screenshotCount = 0;
        
        // Bind methods to preserve context
        this.startCapture = this.startCapture.bind(this);
        this.takeScreenshot = this.takeScreenshot.bind(this);
        this.stopCapture = this.stopCapture.bind(this);
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.startButton = document.getElementById('startCapture');
        this.screenshotButton = document.getElementById('takeScreenshot');
        this.stopButton = document.getElementById('stopCapture');
        this.statusElement = document.getElementById('status');
        this.screenshotsContainer = document.getElementById('screenshots');
        
        // Create hidden video element for capture
        this.videoElement = document.createElement('video');
        this.videoElement.style.display = 'none';
        this.videoElement.autoplay = true;
        this.videoElement.muted = true;
        document.body.appendChild(this.videoElement);
    }

    bindEvents() {
        this.startButton.addEventListener('click', this.startCapture);
        this.screenshotButton.addEventListener('click', this.takeScreenshot);
        this.stopButton.addEventListener('click', this.stopCapture);
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 's':
                        e.preventDefault();
                        if (this.isCapturing) {
                            this.takeScreenshot();
                        }
                        break;
                    case 'q':
                        e.preventDefault();
                        if (this.isCapturing) {
                            this.stopCapture();
                        }
                        break;
                }
            }
        });
    }

    updateStatus(message, type = 'info') {
        this.statusElement.textContent = message;
        this.statusElement.className = `status ${type}`;
    }

    updateButtonStates() {
        this.startButton.disabled = this.isCapturing;
        this.screenshotButton.disabled = !this.isCapturing;
        this.stopButton.disabled = !this.isCapturing;
    }

    async startCapture() {
        try {
            this.updateStatus('🔄 Requesting screen capture permission...', 'info');
            this.startButton.classList.add('pulse');
            
            // Request screen capture with optimal settings
            // Note: Removed preferCurrentTab as it can cause black screenshots due to browser security
            this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 1 },
                preferCurrentTab: true,

                audio: false // We don't need audio for screenshots
            });

            // Set up the video element with the stream
            this.videoElement.srcObject = this.mediaStream;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                this.videoElement.addEventListener('loadedmetadata', resolve, { once: true });
            });

            // Handle stream ending (user stops sharing)
            this.mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
                this.handleStreamEnded();
            });

            this.isCapturing = true;
            this.updateButtonStates();
            this.startButton.classList.remove('pulse');
            this.updateStatus('✅ Screen capture ready! Click "Take Screenshot" or press Ctrl/Cmd+S', 'ready');
            
            // Add visual feedback
            this.screenshotButton.classList.add('pulse');
            setTimeout(() => {
                this.screenshotButton.classList.remove('pulse');
            }, 2000);

        } catch (error) {
            this.handleCaptureError(error);
        }
    }

    async takeScreenshot() {
        if (!this.isCapturing || !this.mediaStream) {
            this.updateStatus('❌ Screen capture is not active!', 'error');
            return;
        }

        try {
            this.updateStatus('📸 Taking screenshot...', 'info');
            this.screenshotButton.classList.add('pulse');
            
            // Debug video element state
            console.log('Video element dimensions:', this.videoElement.videoWidth, 'x', this.videoElement.videoHeight);
            console.log('Video element ready state:', this.videoElement.readyState);
            console.log('Video element current time:', this.videoElement.currentTime);
            
            // Ensure video has content
            if (this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) {
                throw new Error('Video stream has no dimensions - may be blocked by browser security');
            }
            
            // Wait a moment to ensure video is playing
            await this.ensureVideoPlaying();
            
            // Create canvas from video stream
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas dimensions to match video
            canvas.width = this.videoElement.videoWidth;
            canvas.height = this.videoElement.videoHeight;
            
            // Fill canvas with white background first (helps debug black issues)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw current video frame to canvas
            ctx.drawImage(this.videoElement, 0, 0);
            
            // Debug: Check if canvas has content
            const imageData = ctx.getImageData(0, 0, Math.min(100, canvas.width), Math.min(100, canvas.height));
            const hasContent = this.checkCanvasContent(imageData);
            console.log('Canvas has non-black content:', hasContent);
            
            if (!hasContent) {
                // Try alternative approach: capture from ImageCapture API if available
                const altCanvas = await this.tryImageCaptureAPI();
                if (altCanvas) {
                    this.handleScreenshotCapture(await this.canvasToBlob(altCanvas));
                    this.screenshotButton.classList.remove('pulse');
                    this.updateStatus('✅ Screenshot captured using fallback method!', 'ready');
                    return;
                }
                
                this.updateStatus('⚠️ Screenshot may be black due to browser security restrictions. Try selecting a different window/screen.', 'error');
            }
            
            // Convert to blob
            const blob = await this.canvasToBlob(canvas);
            
            // Create download and preview
            this.handleScreenshotCapture(blob);
            
            this.screenshotButton.classList.remove('pulse');
            this.updateStatus('✅ Screenshot captured! Ready for next capture.', 'ready');
            
        } catch (error) {
            this.screenshotButton.classList.remove('pulse');
            console.error('Screenshot capture error:', error);
            this.updateStatus('❌ Failed to capture screenshot: ' + error.message, 'error');
        }
    }

    async ensureVideoPlaying() {
        return new Promise((resolve) => {
            if (this.videoElement.readyState >= 2 && this.videoElement.currentTime > 0) {
                resolve();
            } else {
                const checkPlaying = () => {
                    if (this.videoElement.readyState >= 2) {
                        this.videoElement.removeEventListener('timeupdate', checkPlaying);
                        resolve();
                    }
                };
                this.videoElement.addEventListener('timeupdate', checkPlaying);
                // Fallback timeout
                setTimeout(resolve, 500);
            }
        });
    }

    checkCanvasContent(imageData) {
        // Check if canvas has content other than black pixels
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // If we find any pixel that's not black (or very dark), we have content
            if (r > 10 || g > 10 || b > 10) {
                return true;
            }
        }
        return false;
    }

    async tryImageCaptureAPI() {
        try {
            // Try using ImageCapture API as fallback
            const track = this.mediaStream.getVideoTracks()[0];
            if ('ImageCapture' in window && track) {
                const imageCapture = new ImageCapture(track);
                const bitmap = await imageCapture.grabFrame();
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                ctx.drawImage(bitmap, 0, 0);
                
                return canvas;
            }
        } catch (error) {
            console.log('ImageCapture API fallback failed:', error);
        }
        return null;
    }

    async canvasToBlob(canvas) {
        return new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/png', 1.0);
        });
    }

    handleScreenshotCapture(blob) {
        this.screenshotCount++;
        const timestamp = new Date().toLocaleString().replace(/[/:,]/g, '-');
        const filename = `screenshot-${this.screenshotCount}-${timestamp}.png`;
        
        // Create download URL
        const url = URL.createObjectURL(blob);
        
        // Create preview image
        const img = document.createElement('img');
        img.src = url;
        img.alt = `Screenshot ${this.screenshotCount}`;
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        downloadLink.textContent = `📥 Download ${filename}`;
        
        // Create screenshot item container
        const screenshotItem = document.createElement('div');
        screenshotItem.className = 'screenshot-item';
        screenshotItem.appendChild(img);
        screenshotItem.appendChild(document.createElement('br'));
        screenshotItem.appendChild(downloadLink);
        
        // Add to screenshots container
        this.screenshotsContainer.insertBefore(screenshotItem, this.screenshotsContainer.firstChild);
        
        // Auto-download (optional - can be disabled)
        downloadLink.click();
        
        // Clean up URL after some time
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 60000);
    }

    stopCapture() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        
        this.isCapturing = false;
        this.updateButtonStates();
        this.updateStatus('⏹️ Screen capture stopped.', 'info');
    }

    handleStreamEnded() {
        // This is called when user stops sharing via browser UI
        this.isCapturing = false;
        this.updateButtonStates();
        this.updateStatus('⏹️ Screen sharing ended by user.', 'info');
    }

    handleCaptureError(error) {
        this.startButton.classList.remove('pulse');
        console.error('Screen capture error:', error);
        
        let message = '❌ Failed to start screen capture: ';
        
        switch(error.name) {
            case 'NotAllowedError':
                message += 'Permission denied by user.';
                break;
            case 'NotFoundError':
                message += 'No screen capture source available.';
                break;
            case 'NotSupportedError':
                message += 'Screen capture not supported by browser.';
                break;
            case 'AbortError':
                message += 'Screen capture was aborted.';
                break;
            default:
                message += error.message || 'Unknown error occurred.';
        }
        
        this.updateStatus(message, 'error');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check for browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        document.getElementById('status').textContent = '❌ Screen Capture API not supported in this browser.';
        document.getElementById('status').className = 'status error';
        document.getElementById('startCapture').disabled = true;
        return;
    }
    
    // Create the screenshot capture instance
    new ScreenshotCapture();
    
    console.log('Screenshot capture initialized successfully!');
    console.log('Keyboard shortcuts:');
    console.log('  Ctrl/Cmd+S: Take screenshot (when capturing)');
    console.log('  Ctrl/Cmd+Q: Stop capture');
});

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScreenshotCapture;
}
