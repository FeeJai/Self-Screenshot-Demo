class ScreenshotCapture {
    constructor() {
        this.mediaStream = null;
        this.videoElement = null;
        this.isCapturing = false;
        this.screenshotCount = 0;
        this.captureStartTime = null;
        this.timerInterval = null;
        this.delayTimeout = null;
        this.countdownInterval = null;
        
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
        this.timingInfoElement = document.getElementById('timing-info');
        this.totalCaptureTimeElement = document.getElementById('total-capture-time');
        this.lastScreenshotTimeElement = document.getElementById('last-screenshot-time');
        this.screenshotsContainer = document.getElementById('screenshots');
        this.delayInput = document.getElementById('delayInput');
        
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
            } else if (e.key === 'Escape' && this.delayTimeout) {
                // Cancel screenshot delay with Escape key
                e.preventDefault();
                this.cancelScreenshotDelay();
            }
        });
    }

    updateStatus(message, type = 'info') {
        this.statusElement.textContent = message;
        this.statusElement.className = `status ${type}`;
    }

    updateButtonStates() {
        this.startButton.disabled = this.isCapturing;
        this.screenshotButton.disabled = !this.isCapturing || this.delayTimeout !== null;
        this.stopButton.disabled = !this.isCapturing;
        this.delayInput.disabled = this.isCapturing && this.delayTimeout !== null;
    }

    async startCapture() {
        try {
            this.updateStatus('🔄 Requesting screen capture permission...', 'info');
            this.startButton.classList.add('pulse');
            
            // Request screen capture with optimal settings
            // Note: preferCurrentTab only works in Chromium browsers
            const constraints = {
                video: {
                    displaySurface: "browser",
                    frameRate: 5,
                  },
                audio: false // We don't need audio for screenshots
            };
            
            // Only add preferCurrentTab for Chromium browsers
            const browserInfo = getBrowserInfo();
            if (browserInfo.name === 'Chrome' || browserInfo.name === 'Edge') {
                constraints.preferCurrentTab = true;
            }
            
            this.mediaStream = await navigator.mediaDevices.getDisplayMedia(constraints);

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
            this.startTimer(); // Start the capture timer
            // Provide browser-specific guidance
            let readyMessage = '✅ Screen capture ready! Click "Take Screenshot" or press Ctrl/Cmd+S';
            if (browserInfo.name === 'Firefox' || browserInfo.name === 'Safari') {
                readyMessage += ` (${browserInfo.name} - using video canvas method)`;
            }
            this.updateStatus(readyMessage, 'ready');
            
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

        // Get delay value from input
        const delaySeconds = parseFloat(this.delayInput.value) || 0;
        
        if (delaySeconds > 0) {
            // Start countdown delay
            this.startScreenshotDelay(delaySeconds);
        } else {
            // Take screenshot immediately
            this.captureScreenshotNow();
        }
    }

    startScreenshotDelay(delaySeconds) {
        this.updateButtonStates(); // Disable screenshot button during delay
        this.screenshotButton.classList.add('pulse');
        
        let remainingTime = delaySeconds;
        
        // Update status immediately
        this.updateStatus(`⏱️ Taking screenshot in ${remainingTime.toFixed(1)} seconds...`, 'info');
        
        // Start countdown interval
        this.countdownInterval = setInterval(() => {
            remainingTime -= 0.1;
            
            if (remainingTime <= 0) {
                // Clear interval and take screenshot
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
                this.delayTimeout = null;
                this.updateButtonStates();
                this.captureScreenshotNow();
            } else {
                // Update countdown display
                this.updateStatus(`⏱️ Taking screenshot in ${remainingTime.toFixed(1)} seconds...`, 'info');
            }
        }, 100);
        
        // Set main timeout for screenshot
        this.delayTimeout = setTimeout(() => {
            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
            }
            this.delayTimeout = null;
            this.updateButtonStates();
            this.captureScreenshotNow();
        }, delaySeconds * 1000);
    }

    cancelScreenshotDelay() {
        if (this.delayTimeout) {
            clearTimeout(this.delayTimeout);
            this.delayTimeout = null;
        }
        
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        this.screenshotButton.classList.remove('pulse');
        this.updateButtonStates();
        this.updateStatus('⏹️ Screenshot delay cancelled.', 'info');
    }

    async captureScreenshotNow() {
        try {
            // Capture current timer value BEFORE starting screenshot process
            const currentTimerValue = this.getCurrentTimerValue();
            this.updateTimingInfo(currentTimerValue);
            
            this.updateStatus('📸 Taking screenshot...', 'info');
            
            let canvas, ctx, blob;
            const track = this.mediaStream.getVideoTracks()[0];
            
            if (!track) {
                throw new Error('No video track available');
            }

            // Try ImageCapture API first (Chrome, Edge)
            if ('ImageCapture' in window) {
                try {
                    const imageCapture = new ImageCapture(track);
                    const bitmap = await imageCapture.grabFrame();
                    
                    canvas = document.createElement('canvas');
                    ctx = canvas.getContext('2d');
                    canvas.width = bitmap.width;
                    canvas.height = bitmap.height;
                    ctx.drawImage(bitmap, 0, 0);
                    
                    blob = await this.canvasToBlob(canvas);
                } catch (imageCaptureError) {
                    console.log('ImageCapture failed, falling back to video capture:', imageCaptureError);
                    blob = await this.captureFromVideo();
                }
            } else {
                // Fallback for Safari and Firefox
                blob = await this.captureFromVideo();
            }
            
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

    async captureFromVideo() {
        // Fallback method using video element - works in Safari and Firefox
        return new Promise((resolve, reject) => {
            try {
                // Ensure video is playing
                if (this.videoElement.paused) {
                    this.videoElement.play();
                }
                
                // Wait for next frame to ensure fresh content
                requestAnimationFrame(() => {
                    try {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        // Set canvas size to match video dimensions
                        canvas.width = this.videoElement.videoWidth || 1920;
                        canvas.height = this.videoElement.videoHeight || 1080;
                        
                        // Draw the current video frame to canvas
                        ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
                        
                        // Convert to blob
                        canvas.toBlob((blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                reject(new Error('Failed to create blob from canvas'));
                            }
                        }, 'image/jpeg', 0.92);
                    } catch (canvasError) {
                        reject(new Error('Canvas capture failed: ' + canvasError.message));
                    }
                });
            } catch (videoError) {
                reject(new Error('Video capture setup failed: ' + videoError.message));
            }
        });
    }







    async canvasToBlob(canvas) {
        return new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.92);
        });
    }

    startTimer() {
        this.captureStartTime = Date.now();
        this.timingInfoElement.classList.add('active');
        
        // Update timer every 100ms for smooth decimal display
        this.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.timingInfoElement.classList.remove('active');
        
        // Reset timing display values
        this.totalCaptureTimeElement.textContent = '--:--.-';
        this.lastScreenshotTimeElement.textContent = '--:--.-';
        
        this.captureStartTime = null;
    }

    updateTimer() {
        if (!this.captureStartTime) return;
        
        const elapsed = (Date.now() - this.captureStartTime) / 1000;
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        // Format as MM:SS.S
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
        this.totalCaptureTimeElement.textContent = formattedTime;
    }

    getCurrentTimerValue() {
        if (!this.captureStartTime) return '--:--.-';
        
        const elapsed = (Date.now() - this.captureStartTime) / 1000;
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        // Format as MM:SS.S
        return `${minutes.toString().padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
    }

    updateTimingInfo(timerValue) {
        // Only update the "Time Of Last Screenshot" value - the main timer continues running in totalCaptureTimeElement
        this.lastScreenshotTimeElement.textContent = timerValue;
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
        // Cancel any pending screenshot delay
        this.cancelScreenshotDelay();
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        
        this.isCapturing = false;
        this.stopTimer(); // Stop the capture timer
        this.updateButtonStates();
        this.updateStatus('⏹️ Screen capture stopped.', 'info');
    }

    handleStreamEnded() {
        // This is called when user stops sharing via browser UI
        // Cancel any pending screenshot delay
        this.cancelScreenshotDelay();
        
        this.isCapturing = false;
        this.stopTimer(); // Stop the capture timer
        this.updateButtonStates();
        this.updateStatus('⏹️ Screen sharing ended by user.', 'info');
    }

    handleCaptureError(error) {
        this.startButton.classList.remove('pulse');
        this.stopTimer(); // Stop timer on error
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
    
    // Check capture method support and provide browser info
    const browserInfo = getBrowserInfo();
    console.log(`Screenshot capture initialized on ${browserInfo.name}!`);
    
    if (browserInfo.supportsImageCapture) {
        console.log('✅ Using ImageCapture API for high-quality screenshots');
        console.log('✅ preferCurrentTab option available (Chromium)');
    } else {
        console.log('⚠️ Using video canvas fallback (ImageCapture not available)');
        console.log('ℹ️ Screen sharing picker will show all available sources');
    }
    
    // Create the screenshot capture instance
    new ScreenshotCapture();
    
    console.log('Keyboard shortcuts:');
    console.log('  Ctrl/Cmd+S: Take screenshot (when capturing)');
    console.log('  Ctrl/Cmd+Q: Stop capture');
    console.log('  Escape: Cancel screenshot delay countdown');
});

function getBrowserInfo() {
    const userAgent = navigator.userAgent;
    let browserName = 'Unknown Browser';
    let supportsImageCapture = 'ImageCapture' in window;
    
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
        browserName = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
        browserName = 'Firefox';
        supportsImageCapture = false; // Firefox has limited ImageCapture support
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        browserName = 'Safari';
        supportsImageCapture = false; // Safari doesn't support ImageCapture
    } else if (userAgent.includes('Edg')) {
        browserName = 'Edge';
    }
    
    return {
        name: browserName,
        supportsImageCapture: supportsImageCapture
    };
}

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScreenshotCapture;
}
