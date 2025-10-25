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
        this.targetFPS = 60; // ПОВЫШАЕМ FPS
        this.frameSkipCounter = 0;
        
        // Кэш для оптимизации
        this.tempCanvas = document.createElement('canvas');
        this.tempCtx = this.tempCanvas.getContext('2d');
        this.maskCanvas = document.createElement('canvas');
        this.maskCtx = this.maskCanvas.getContext('2d');
        this.erodedMaskCanvas = document.createElement('canvas');
        this.erodedMaskCtx = this.erodedMaskCanvas.getContext('2d');
        this.textCanvas = document.createElement('canvas');
        this.textCtx = this.textCanvas.getContext('2d');
        this.debugMaskCanvas = document.createElement('canvas');
        this.debugMaskCtx = this.debugMaskCanvas.getContext('2d');
        this.backgroundCanvas = document.createElement('canvas');
        this.backgroundCtx = this.backgroundCanvas.getContext('2d');
        
        this.lastMask = null;
        this.forceRedraw = false;

        console.log('⚡ Режим: ВЫСОКАЯ ПРОИЗВОДИТЕЛЬНОСТЬ 60 FPS');
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
                    frameRate: { ideal: 30 },
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
                }, 2000);
            });
            
            console.log('✅ Камера успешно запущена');
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
        this.erodedMaskCanvas.width = width;
        this.erodedMaskCanvas.height = height;
        this.textCanvas.width = width;
        this.textCanvas.height = height;
        this.debugMaskCanvas.width = this.debugCanvas.width;
        this.debugMaskCanvas.height = this.debugCanvas.height;
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
        this.erodedMaskCanvas.width = width;
        this.erodedMaskCanvas.height = height;
        this.textCanvas.width = width;
        this.textCanvas.height = height;
        this.debugMaskCanvas.width = this.debugCanvas.width;
        this.debugMaskCanvas.height = this.debugCanvas.height;
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
        console.log('🎬 Начинаем обработку видео...');
        
        this.processFrame();
    }

    waitForVideoReady() {
        return new Promise((resolve) => {
            if (this.videoElement.readyState >= 2 && this.videoElement.videoWidth > 0) {
                resolve();
            } else {
                this.videoElement.addEventListener('loadeddata', () => resolve(), { once: true });
                setTimeout(() => resolve(), 1000);
            }
        });
    }

    // ОПТИМИЗИРОВАННЫЙ МЕТОД ОБРАБОТКИ КАДРА
    async processFrame() {
        if (!this.isProcessing) return;
        
        const frameStartTime = performance.now();
        
        // АДАПТИВНЫЙ КОНТРОЛЬ FPS
        const timeSinceLastFrame = frameStartTime - this.lastFrameTime;
        const targetFrameTime = 1000 / this.targetFPS;
        
        if (timeSinceLastFrame < targetFrameTime && !this.forceRedraw) {
            setTimeout(() => {
                requestAnimationFrame(() => this.processFrame());
            }, targetFrameTime - timeSinceLastFrame);
            return;
        }
        
        this.lastFrameTime = frameStartTime;
        
        try {
            // УМНАЯ ОПТИМИЗАЦИЯ: пропускаем обработку если нет изменений
            if (!this.forceRedraw && this.shouldSkipFrame()) {
                requestAnimationFrame(() => this.processFrame());
                return;
            }
            
            let result;
            if (this.forceRedraw || this.frameSkipCounter % 2 === 0) {
                result = await this.segmentator.segmentFrame(this.videoElement);
                if (result && result.segmentation) {
                    this.lastMask = result.segmentation;
                }
                this.forceRedraw = false;
            } else {
                result = { 
                    segmentation: this.lastMask,
                    processingTime: 1
                };
            }
            
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

    // ПРОВЕРКА НЕОБХОДИМОСТИ ОБРАБОТКИ КАДРА
    shouldSkipFrame() {
        // Пропускаем кадр если мало изменений
        return this.frameSkipCounter % 3 !== 0 && this.lastMask;
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

    // ОПТИМИЗИРОВАННАЯ СЕГМЕНТАЦИЯ
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
            
            // ПОДГОТОВКА ФОНА
            this.prepareBackground();
            const backgroundImageData = this.backgroundCtx.getImageData(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
            
            // БЫСТРОЕ КОМБИНИРОВАНИЕ
            const outputImageData = this.ctx.createImageData(this.outputCanvas.width, this.outputCanvas.height);
            
            let whitePixels = 0;
            let blackPixels = 0;
            
            // ОПТИМИЗИРОВАННЫЙ ЦИКЛ
            const data = maskImageData.data;
            const origData = originalImageData.data;
            const bgData = backgroundImageData.data;
            const outData = outputImageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const maskValue = data[i];
                
                if (maskValue > 200) {
                    // Человек - копируем оригинал
                    outData[i] = origData[i];
                    outData[i + 1] = origData[i + 1];
                    outData[i + 2] = origData[i + 2];
                    whitePixels++;
                } else if (maskValue > 100) {
                    // Плавный переход (упрощенный)
                    const blend = maskValue / 255;
                    outData[i] = origData[i] * blend + bgData[i] * (1 - blend);
                    outData[i + 1] = origData[i + 1] * blend + bgData[i + 1] * (1 - blend);
                    outData[i + 2] = origData[i + 2] * blend + bgData[i + 2] * (1 - blend);
                    whitePixels++;
                } else {
                    // Фон
                    outData[i] = bgData[i];
                    outData[i + 1] = bgData[i + 1];
                    outData[i + 2] = bgData[i + 2];
                    blackPixels++;
                }
                outData[i + 3] = 255;
            }
            
            this.ctx.putImageData(outputImageData, 0, 0);
            this.updateDebugInfo(whitePixels, blackPixels);
            
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
    }

    // ДОБАВИМ МЕТОД ДЛЯ ПРИНУДИТЕЛЬНОГО ОБНОВЛЕНИЯ
    forceUpdate() {
        console.log('🎯 Принудительное обновление видеоактивировано');
        this.forceRedraw = true;
        this.lastMask = null; // Сбрасываем маску чтобы пересчитать
    }

    prepareBackground() {
        this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
        
        if (this.currentBackground.startsWith('image')) {
            this.drawImageBackground(this.currentBackground);
        } else {
            switch (this.currentBackground) {
                case 'green':
                    this.backgroundCtx.fillStyle = '#00ff00';
                    this.backgroundCtx.fillRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
                    break;
                case 'blur':
                    this.drawBlurBackground();
                    break;
                case 'video':
                    this.drawVideoBackground();
                    break;
                default:
                    this.backgroundCtx.fillStyle = '#00ff00';
                    this.backgroundCtx.fillRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
            }
        }
    }

    drawImageBackground(backgroundType) {
        const image = this.backgroundManager.getBackgroundImage(backgroundType);
        
        if (image && image.complete && image.naturalWidth > 0) {
            try {
                const imgRatio = image.width / image.height;
                const canvasRatio = this.backgroundCanvas.width / this.backgroundCanvas.height;
                
                let drawWidth, drawHeight, offsetX, offsetY;

                if (imgRatio > canvasRatio) {
                    drawHeight = this.backgroundCanvas.height;
                    drawWidth = this.backgroundCanvas.height * imgRatio;
                    offsetX = (this.backgroundCanvas.width - drawWidth) / 2;
                    offsetY = 0;
                } else {
                    drawWidth = this.backgroundCanvas.width;
                    drawHeight = this.backgroundCanvas.width / imgRatio;
                    offsetX = 0;
                    offsetY = (this.backgroundCanvas.height - drawHeight) / 2;
                }

                this.backgroundCtx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
                
            } catch (error) {
                console.error(`❌ Ошибка рисования изображения ${backgroundType}:`, error);
                this.drawFallbackBackground(backgroundType);
            }
        } else {
            this.drawFallbackBackground(backgroundType);
        }
    }

    drawVideoBackground() {
        const video = this.backgroundManager.getVideoElement();
        
        if (!video || video.readyState < 2) {
            console.log('⚠️ Видео не готово, используем fallback');
            this.drawFallbackVideoBackground();
            
            // Пытаемся перезагрузить видео
            if (video && !this.backgroundManager.isVideoLoaded()) {
                this.backgroundManager.preloadVideo().then(success => {
                    if (success) {
                        console.log('✅ Видео перезагружено успешно');
                    }
                });
            }
            return;
        }

        try {
            // Запускаем видео если оно еще не играет
            if (!this.isVideoPlaying && video.paused) {
                video.play().then(() => {
                    this.isVideoPlaying = true;
                    console.log('▶️ Видео фон запущено');
                }).catch(error => {
                    console.log('⚠️ Не удалось воспроизвести видео:', error);
                    this.drawFallbackVideoBackground();
                    return;
                });
            }

            const videoWidth = video.videoWidth || 640;
            const videoHeight = video.videoHeight || 480;
            const videoRatio = videoWidth / videoHeight;
            const canvasRatio = this.backgroundCanvas.width / this.backgroundCanvas.height;
            
            let drawWidth, drawHeight, offsetX, offsetY;

            if (videoRatio > canvasRatio) {
                // Видео шире чем canvas
                drawHeight = this.backgroundCanvas.height;
                drawWidth = this.backgroundCanvas.height * videoRatio;
                offsetX = (this.backgroundCanvas.width - drawWidth) / 2;
                offsetY = 0;
            } else {
                // Видео выше чем canvas
                drawWidth = this.backgroundCanvas.width;
                drawHeight = this.backgroundCanvas.width / videoRatio;
                offsetX = 0;
                offsetY = (this.backgroundCanvas.height - drawHeight) / 2;
            }

            // Очищаем и рисуем видео
            this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
            this.backgroundCtx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
            
        } catch (error) {
            console.error('❌ Ошибка рисования видео:', error);
            this.drawFallbackVideoBackground();
        }
    }

    drawBlurBackground() {
        this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        this.tempCtx.drawImage(this.videoElement, 0, 0, this.tempCanvas.width, this.tempCanvas.height);
        this.tempCtx.filter = 'blur(8px)';
        this.tempCtx.drawImage(this.tempCanvas, 0, 0);
        this.tempCtx.filter = 'none';
        this.backgroundCtx.drawImage(this.tempCanvas, 0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
    }

    drawFallbackBackground(backgroundType) {
        const colors = {
            'image1': '#FF6B6B', 'image2': '#4ECDC4', 'image3': '#45B7D1',
            'image4': '#96CEB4', 'image5': '#FFEAA7', 'image6': '#DDA0DD', 'image7': '#98D8C8'
        };
        
        const gradient = this.backgroundCtx.createLinearGradient(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
        const baseColor = colors[backgroundType] || '#00ff00';
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(1, this.lightenColor(baseColor, 30));
        
        this.backgroundCtx.fillStyle = gradient;
        this.backgroundCtx.fillRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
    }

    drawFallbackVideoBackground() {
        const time = Date.now() * 0.001;
        const hue = (time * 20) % 360;
        
        const gradient = this.backgroundCtx.createLinearGradient(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
        gradient.addColorStop(0, `hsl(${hue}, 70%, 50%)`);
        gradient.addColorStop(1, `hsl(${hue + 60}, 70%, 60%)`);
        
        this.backgroundCtx.fillStyle = gradient;
        this.backgroundCtx.fillRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
        
        // Добавляем текст "Video Loading..."
        this.backgroundCtx.fillStyle = 'white';
        this.backgroundCtx.font = '20px Arial';
        this.backgroundCtx.textAlign = 'center';
        this.backgroundCtx.fillText('Video Loading...', this.backgroundCanvas.width / 2, this.backgroundCanvas.height / 2);
    }

    lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return "#" + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
    }

    updateDebugCanvas(maskCanvas) {
        this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
        
        this.debugMaskCtx.clearRect(0, 0, this.debugMaskCanvas.width, this.debugMaskCanvas.height);
        this.debugMaskCtx.save();
        this.debugMaskCtx.scale(-1, 1);
        this.debugMaskCtx.drawImage(maskCanvas, -this.debugMaskCanvas.width, 0, this.debugMaskCanvas.width, this.debugMaskCanvas.height);
        this.debugMaskCtx.restore();
        
        this.debugCtx.drawImage(this.debugMaskCanvas, 0, 0, this.debugCanvas.width, this.debugCanvas.height);
        
        this.debugCtx.strokeStyle = '#ff0000';
        this.debugCtx.lineWidth = 2;
        this.debugCtx.strokeRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
    }

    updateDebugInfo(whitePixels, blackPixels) {
        document.getElementById('whitePixels').textContent = whitePixels.toLocaleString();
        document.getElementById('blackPixels').textContent = blackPixels.toLocaleString();
        document.getElementById('personPixels').textContent = whitePixels.toLocaleString();
        document.getElementById('debugMode').textContent = `${this.fps} FPS`;
    }

    updatePerformanceStats(processingTime) {
        this.frameCount++;
        const now = performance.now();
        
        if (now - this.lastFpsUpdate >= 1000) {
            this.fps = Math.round(this.frameCount);
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
        console.log(`🎨 Фон изменен на: ${background}`);
        
        // Если выбран видео фон, пытаемся загрузить его
        if (background === 'video' && !this.backgroundManager.isVideoLoaded()) {
            console.log('🔄 Пытаемся загрузить видео фон...');
            this.backgroundManager.preloadVideo().then(success => {
                if (success) {
                    console.log('✅ Видео фон загружен при смене фона');
                } else {
                    console.log('❌ Не удалось загрузить видео фон');
                }
            });
        }
        
        // Останавливаем видео если переключились на другой фон
        if (background !== 'video' && this.isVideoPlaying) {
            const video = this.backgroundManager.getVideoElement();
            if (video) {
                video.pause();
                this.isVideoPlaying = false;
            }
        }
    }

    setQuality(quality) {
        this.quality = 'high';
        this.targetFPS = 60;
        
        if (this.segmentator) {
            this.segmentator.setQuality('high');
        }
        
        console.log(`⚡ Режим: 60 FPS`);
    }
}