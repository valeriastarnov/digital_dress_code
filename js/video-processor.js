class VideoProcessor {
    constructor() {
        this.videoElement = document.getElementById('webcam');
        this.outputCanvas = document.getElementById('outputCanvas');
        this.ctx = this.outputCanvas.getContext('2d', { willReadFrequently: true });
        
        // Элементы для отладки
        this.debugCanvas = document.getElementById('debugCanvas');
        this.debugCtx = this.debugCanvas.getContext('2d');
        
        this.employeeDisplay = null;
        this.backgroundManager = new BackgroundManager();

        // Видео для фона
        this.backgroundVideo = document.getElementById('backgroundVideo');
        this.isVideoPlaying = false;

        this.stream = null;
        this.isProcessing = false;
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.lastFrameTime = 0;
        
        this.segmentator = null;
        this.currentBackground = 'green';
        this.quality = 'high';
        this.targetFPS = 60; // СНИЖАЕМ ДО 60 FPS ДЛЯ СТАБИЛЬНОСТИ
        this.frameSkipCounter = 0;
        
        // Кэш для оптимизации
        this.tempCanvas = document.createElement('canvas');
        this.tempCtx = this.tempCanvas.getContext('2d');
        this.maskCanvas = document.createElement('canvas');
        this.maskCtx = this.maskCanvas.getContext('2d');
        this.backgroundCanvas = document.createElement('canvas');
        this.backgroundCtx = this.backgroundCanvas.getContext('2d');
        
        this.lastMask = null;
        this.forceRedraw = false;
        this.lastBackgroundRedraw = 0;
        this.backgroundRedrawInterval = 8; // ЕЩЕ БЫСТРЕЕ: 8мс ≈ 125 FPS для фона
        this.lastSegmentationTime = 0;
        this.segmentationInterval = 33; // СЕГМЕНТАЦИЯ КАЖДЫЕ 33мс ≈ 30 FPS

        console.log('⚡ Режим: ОПТИМИЗИРОВАННЫЙ 60 FPS');
    }

    setEmployeeDisplay(employeeDisplay) {
        this.employeeDisplay = employeeDisplay;
    }

    setSegmentator(segmentator) {
        this.segmentator = segmentator;
    }

    async startCamera() {
        console.log('📹 Запускаем камеру...');
        
        try {
            const constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 60 }, // 60 FPS для камеры
                    facingMode: 'user'
                },
                audio: false
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            
            await new Promise((resolve) => {
                const onLoaded = () => {
                    this.videoElement.removeEventListener('loadeddata', onLoaded);
                    this.setCanvasSizes();
                    resolve();
                };
                
                this.videoElement.addEventListener('loadeddata', onLoaded);
                
                setTimeout(() => {
                    this.videoElement.removeEventListener('loadeddata', onLoaded);
                    this.setDefaultCanvasSizes();
                    resolve();
                }, 1000);
            });
            
            console.log('✅ Камера успешно запущена (60 FPS)');
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка доступа к камере:', error);
            this.showCameraError(error);
            return false;
        }
    }

    setCanvasSizes() {
        const width = this.videoElement.videoWidth || 640;
        const height = this.videoElement.videoHeight || 480;
        
        this.outputCanvas.width = width;
        this.outputCanvas.height = height;
        this.debugCanvas.width = Math.floor(width / 2);
        this.debugCanvas.height = Math.floor(height / 2);
        this.tempCanvas.width = width;
        this.tempCanvas.height = height;
        this.maskCanvas.width = width;
        this.maskCanvas.height = height;
        this.backgroundCanvas.width = width;
        this.backgroundCanvas.height = height;
    }

    setDefaultCanvasSizes() {
        const width = 640, height = 480;
        this.outputCanvas.width = width;
        this.outputCanvas.height = height;
        this.debugCanvas.width = Math.floor(width / 2);
        this.debugCanvas.height = Math.floor(height / 2);
        this.tempCanvas.width = width;
        this.tempCanvas.height = height;
        this.maskCanvas.width = width;
        this.maskCanvas.height = height;
        this.backgroundCanvas.width = width;
        this.backgroundCanvas.height = height;
    }

    showCameraError(error) {
        let message = 'Не удалось получить доступ к камере.';
        
        if (error.name === 'NotAllowedError') {
            message += '\n\nРазрешите доступ к камере в настройках браузера.';
        } else if (error.name === 'NotFoundError') {
            message += '\n\nКамера не найдена.';
        }
        
        alert(message);
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.backgroundVideo) {
            this.backgroundVideo.pause();
            this.backgroundVideo.currentTime = 0;
            this.isVideoPlaying = false;
        }
        
        this.isProcessing = false;
        this.lastMask = null;
    }

    async startProcessing() {
        if (!this.segmentator) {
            console.error('Сегментатор не установлен!');
            return;
        }

        await this.waitForVideoReady();
        
        this.isProcessing = true;
        this.lastFrameTime = performance.now();
        this.lastBackgroundRedraw = performance.now();
        this.lastSegmentationTime = performance.now();
        console.log('🎬 Начинаем обработку видео (60 FPS)...');
        
        this.processFrame();
    }

    waitForVideoReady() {
        return new Promise((resolve) => {
            if (this.videoElement.readyState >= 2 && this.videoElement.videoWidth > 0) {
                resolve();
            } else {
                this.videoElement.addEventListener('loadeddata', () => resolve(), { once: true });
                setTimeout(() => resolve(), 500);
            }
        });
    }

    // ОПТИМИЗИРОВАННЫЙ МЕТОД С БЫСТРОЙ СЕГМЕНТАЦИЕЙ
    async processFrame() {
        if (!this.isProcessing) return;
        
        const frameStartTime = performance.now();
        
        // БАЗОВЫЙ КОНТРОЛЬ FPS
        const timeSinceLastFrame = frameStartTime - this.lastFrameTime;
        const targetFrameTime = 1000 / this.targetFPS;
        
        if (timeSinceLastFrame < targetFrameTime - 1) {
            requestAnimationFrame(() => this.processFrame());
            return;
        }
        
        this.lastFrameTime = frameStartTime;
        this.frameSkipCounter++;
        
        try {
            // СУПЕР-БЫСТРОЕ ОБНОВЛЕНИЕ ФОНА - КАЖДЫЕ 8мс
            const needsBackgroundUpdate = this.shouldUpdateBackground(frameStartTime);
            const needsSegmentation = this.shouldUpdateSegmentation(frameStartTime);
            
            if (needsBackgroundUpdate) {
                this.prepareBackground();
                this.lastBackgroundRedraw = frameStartTime;
            }
            
            let result;
            if (needsSegmentation) {
                result = await this.segmentator.segmentFrame(this.videoElement);
                if (result && result.segmentation) {
                    this.lastMask = result.segmentation;
                    this.lastSegmentationTime = frameStartTime;
                }
                this.forceRedraw = false;
            } else {
                result = { 
                    segmentation: this.lastMask,
                    processingTime: 0.1
                };
            }
            
            // ВСЕГДА ОТРИСОВЫВАЕМ КАДР
            if (result && result.segmentation) {
                this.fastDrawSegmentation(result.segmentation);
            } else {
                this.fastDrawFallback();
            }
            
            this.updatePerformanceStats(result ? result.processingTime : 0);
            
        } catch (error) {
            console.error('Ошибка обработки кадра:', error);
            this.fastDrawFallback();
        }
        
        requestAnimationFrame(() => this.processFrame());
    }

    // ПРОВЕРКА ОБНОВЛЕНИЯ ФОНА (8мс)
    shouldUpdateBackground(currentTime) {
        // Для видео и размытия обновляем каждый кадр
        if (this.currentBackground === 'video' || this.currentBackground === 'blur') {
            return true;
        }
        
        // Для статических фонов обновляем каждые 8мс
        return (currentTime - this.lastBackgroundRedraw) > this.backgroundRedrawInterval;
    }

    // ПРОВЕРКА ОБНОВЛЕНИЯ СЕГМЕНТАЦИИ (33мс ≈ 30 FPS)
    shouldUpdateSegmentation(currentTime) {
        if (this.forceRedraw) return true;
        
        // Обновляем сегментацию каждые 33мс для плавности
        return (currentTime - this.lastSegmentationTime) > this.segmentationInterval;
    }

    // БЫСТРАЯ ОТРИСОВКА СЕГМЕНТАЦИИ
    fastDrawSegmentation(segmentation) {
        this.ctx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);

        if (!segmentation || !segmentation.segmentationMask) {
            this.fastDrawFallback();
            return;
        }

        try {
            this.fastApplySegmentation(segmentation);
        } catch (error) {
            console.error('Ошибка отрисовки:', error);
            this.fastDrawFallback();
        }
    }

    // БЫСТРАЯ СЕГМЕНТАЦИЯ
    fastApplySegmentation(results) {
        if (!results.segmentationMask) {
            this.fastDrawFallback();
            return;
        }

        try {
            const segmentationMask = results.segmentationMask;
            
            // БЫСТРАЯ ПОДГОТОВКА МАСКИ
            this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
            this.maskCtx.drawImage(segmentationMask, 0, 0);
            const maskImageData = this.maskCtx.getImageData(0, 0, this.maskCanvas.width, this.maskCanvas.height);
            
            // ОРИГИНАЛЬНОЕ ВИДЕО
            this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
            this.tempCtx.drawImage(this.videoElement, 0, 0);
            const originalImageData = this.tempCtx.getImageData(0, 0, this.tempCanvas.width, this.tempCanvas.height);
            
            // БЫСТРОЕ КОМБИНИРОВАНИЕ
            const outputImageData = this.ctx.createImageData(this.outputCanvas.width, this.outputCanvas.height);
            
            let whitePixels = 0;
            let blackPixels = 0;
            
            const data = maskImageData.data;
            const origData = originalImageData.data;
            const bgData = this.backgroundCtx.getImageData(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height).data;
            const outData = outputImageData.data;
            const dataLength = data.length;
            
            // ОПТИМИЗИРОВАННЫЙ ЦИКЛ
            for (let i = 0; i < dataLength; i += 4) {
                const maskValue = data[i];
                
                if (maskValue > 128) {
                    outData[i] = origData[i];
                    outData[i + 1] = origData[i + 1];
                    outData[i + 2] = origData[i + 2];
                    whitePixels++;
                } else {
                    outData[i] = bgData[i];
                    outData[i + 1] = bgData[i + 1];
                    outData[i + 2] = bgData[i + 2];
                    blackPixels++;
                }
                outData[i + 3] = 255;
            }
            
            this.ctx.putImageData(outputImageData, 0, 0);
            
            // ОБНОВЛЯЕМ ОТЛАДКУ
            this.updateDebugInfo(whitePixels, blackPixels);
            this.updateDebugCanvas(segmentationMask);
            
            // Отрисовываем данные сотрудника
            if (this.employeeDisplay) {
                this.employeeDisplay.drawOnCanvas(this.ctx, 10, 10, 300, 200);
            }
            
        } catch (error) {
            console.error('❌ Ошибка в fastApplySegmentation:', error);
            this.fastDrawFallback();
        }
    }

    // БЫСТРЫЙ FALLBACK
    fastDrawFallback() {
        this.ctx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
        this.ctx.drawImage(this.videoElement, 0, 0, this.outputCanvas.width, this.outputCanvas.height);
        
        if (this.employeeDisplay) {
            this.employeeDisplay.drawOnCanvas(this.ctx, 10, 10, 300, 200);
        }
        
        const totalPixels = this.outputCanvas.width * this.outputCanvas.height;
        this.updateDebugInfo(totalPixels, 0);
    }

    // ОПТИМИЗИРОВАННАЯ ПОДГОТОВКА ФОНА
    prepareBackground() {
        this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
        
        switch (this.currentBackground) {
            case 'green':
                this.fastSolidBackground('#00ff00');
                break;
            case 'blur':
                this.fastBlurBackground();
                break;
            case 'video':
                this.fastVideoBackground();
                break;
            default:
                if (this.currentBackground.startsWith('image')) {
                    this.fastImageBackground(this.currentBackground);
                } else {
                    this.fastSolidBackground('#00ff00');
                }
        }
    }

    // БЫСТРАЯ ЗАЛИВКА ЦВЕТОМ
    fastSolidBackground(color) {
        this.backgroundCtx.fillStyle = color;
        this.backgroundCtx.fillRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
    }

    // БЫСТРОЕ РАЗМЫТИЕ
    fastBlurBackground() {
        this.tempCtx.drawImage(this.videoElement, 0, 0, 80, 60);
        this.tempCtx.filter = 'blur(3px)';
        this.tempCtx.drawImage(this.tempCanvas, 0, 0, 80, 60, 0, 0, 80, 60);
        this.tempCtx.filter = 'none';
        this.backgroundCtx.drawImage(this.tempCanvas, 0, 0, 80, 60, 0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
    }

    // БЫСТРОЕ ИЗОБРАЖЕНИЕ
    fastImageBackground(backgroundType) {
        const image = this.backgroundManager.getBackgroundImage(backgroundType);
        
        if (image && image.complete && image.naturalWidth > 0) {
            this.backgroundCtx.drawImage(image, 0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
        } else {
            this.fastFallbackBackground(backgroundType);
        }
    }

    // БЫСТРОЕ ВИДЕО
    fastVideoBackground() {
        const video = this.backgroundManager.getVideoElement();
        
        if (!video || video.readyState < 2) {
            this.fastFallbackVideoBackground();
            return;
        }

        if (!this.isVideoPlaying && video.paused) {
            video.play().catch(() => {
                this.fastFallbackVideoBackground();
            });
        }

        if (video.readyState >= 2) {
            this.backgroundCtx.drawImage(video, 0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
        }
    }

    fastFallbackBackground(backgroundType) {
        const colors = {
            'image1': '#FF6B6B', 'image2': '#4ECDC4', 'image3': '#45B7D1',
            'image4': '#96CEB4', 'image5': '#FFEAA7', 'image6': '#DDA0DD', 'image7': '#98D8C8'
        };
        this.fastSolidBackground(colors[backgroundType] || '#00ff00');
    }

    fastFallbackVideoBackground() {
        this.fastSolidBackground('#0000ff');
    }

    // ЧЕРНО-БЕЛАЯ ОТЛАДКА
    updateDebugCanvas(maskCanvas) {
        if (!this.debugCtx || !maskCanvas) return;
        
        this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
        
        try {
            const tempDebugCanvas = document.createElement('canvas');
            tempDebugCanvas.width = this.debugCanvas.width;
            tempDebugCanvas.height = this.debugCanvas.height;
            const tempDebugCtx = tempDebugCanvas.getContext('2d');
            
            tempDebugCtx.save();
            tempDebugCtx.scale(-1, 1);
            tempDebugCtx.drawImage(maskCanvas, -this.debugCanvas.width, 0, this.debugCanvas.width, this.debugCanvas.height);
            tempDebugCtx.restore();
            
            const imageData = tempDebugCtx.getImageData(0, 0, this.debugCanvas.width, this.debugCanvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const maskValue = data[i];
                
                if (maskValue > 128) {
                    data[i] = 255;
                    data[i + 1] = 255;
                    data[i + 2] = 255;
                } else {
                    data[i] = 0;
                    data[i + 1] = 0;
                    data[i + 2] = 0;
                }
                data[i + 3] = 255;
            }
            
            this.debugCtx.putImageData(imageData, 0, 0);
            
            this.debugCtx.strokeStyle = '#00ff00';
            this.debugCtx.lineWidth = 2;
            this.debugCtx.strokeRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
            
            this.debugCtx.fillStyle = '#00ff00';
            this.debugCtx.font = 'bold 12px Arial';
            this.debugCtx.fillText('🔍 Маска (Ч/Б)', 5, 15);
            
        } catch (error) {
            console.error('Ошибка отрисовки отладочного канваса:', error);
        }
    }

    updateDebugInfo(whitePixels, blackPixels) {
        const totalPixels = this.outputCanvas.width * this.outputCanvas.height;
        const personPercentage = ((whitePixels / totalPixels) * 100).toFixed(1);
        
        const elements = {
            'whitePixels': whitePixels.toLocaleString(),
            'blackPixels': blackPixels.toLocaleString(),
            'personPixels': whitePixels.toLocaleString(),
            'debugMode': `${this.fps} FPS (${personPercentage}% человека)`
        };
        
        for (const [id, value] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        }
    }

    updatePerformanceStats(processingTime) {
        this.frameCount++;
        const now = performance.now();
        
        if (now - this.lastFpsUpdate >= 500) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = now;
            
            document.getElementById('fpsCounter').textContent = this.fps;
            document.getElementById('processingTime').textContent = processingTime ? processingTime.toFixed(1) : '0';
        }
    }

    stopProcessing() {
        this.isProcessing = false;
        this.lastMask = null;
    }

    setBackground(background) {
        this.currentBackground = background;
        this.forceRedraw = true;
        this.lastBackgroundRedraw = 0;
        console.log(`🎨 Фон изменен на: ${background}`);
    }

    setQuality(quality) {
        this.quality = 'optimized';
        this.targetFPS = 60;
        console.log(`⚡ Режим: ОПТИМИЗИРОВАННЫЙ 60 FPS`);
    }
}