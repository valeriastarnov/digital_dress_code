class Segmentator {
    constructor() {
        this.model = null;
        this.isModelLoaded = false;
        this.lastResults = null;
        this.useFallback = false;
        this.quality = 'high';
        this.lastVideoTime = 0;
        this.frameCounter = 0;
        this.processingFrame = false;
    }

    async loadModel() {
        console.log('🔄 Загружаем MediaPipe Selfie Segmentation...');
        
        return new Promise((resolve) => {
            if (typeof SelfieSegmentation === 'undefined') {
                console.error('❌ MediaPipe не загружен!');
                this.createFallbackModel();
                resolve(true);
                return;
            }

            try {
                this.model = new SelfieSegmentation({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
                    }
                });
                
                // ОПТИМИЗИРОВАННЫЕ НАСТРОЙКИ ДЛЯ СКОРОСТИ
                this.model.setOptions({
                    modelSelection: 1, // Точная модель
                    selfieMode: false,
                });
                
                this.model.onResults((results) => {
                    this.lastResults = results;
                    this.processingFrame = false;
                });
                
                this.isModelLoaded = true;
                console.log('✅ MediaPipe загружена!');
                resolve(true);
                
            } catch (error) {
                console.error('❌ Ошибка загрузки MediaPipe:', error);
                this.createFallbackModel();
                resolve(true);
            }
        });
    }

    createFallbackModel() {
        console.log('🔄 Создаем fallback модель...');
        this.isModelLoaded = true;
        this.useFallback = true;
    }

    async segmentFrame(videoElement) {
        if (!this.isModelLoaded || this.processingFrame) {
            return { segmentation: this.lastResults, processingTime: 0 };
        }

        if (this.useFallback) {
            return this.fastFallbackSegmentation(videoElement);
        }

        if (videoElement.readyState < 2 || videoElement.videoWidth === 0) {
            return { segmentation: null, processingTime: 0 };
        }

        // ОПТИМИЗАЦИЯ: пропускаем каждый 3-й кадр для увеличения FPS
        this.frameCounter++;
        if (this.frameCounter % 3 !== 0 && this.lastResults) {
            return { 
                segmentation: this.lastResults, 
                processingTime: 1 
            };
        }

        if (videoElement.currentTime === this.lastVideoTime && this.lastResults) {
            return { 
                segmentation: this.lastResults, 
                processingTime: 0 
            };
        }
        
        this.lastVideoTime = videoElement.currentTime;

        try {
            this.processingFrame = true;
            const startTime = performance.now();
            await this.model.send({image: videoElement});
            const processingTime = performance.now() - startTime;
            
            if (this.lastResults && this.lastResults.segmentationMask) {
                // БЫСТРОЕ СГЛАЖИВАНИЕ МАСКИ
                const smoothMask = this.fastSmoothSegmentationMask(this.lastResults.segmentationMask);
                this.lastResults.segmentationMask = smoothMask;
                
                return {
                    segmentation: this.lastResults,
                    processingTime: processingTime
                };
            } else {
                return this.fastFallbackSegmentation(videoElement);
            }
            
        } catch (error) {
            console.error('❌ Ошибка сегментации MediaPipe:', error);
            this.processingFrame = false;
            return this.fastFallbackSegmentation(videoElement);
        }
    }

    // ОПТИМИЗИРОВАННЫЙ МЕТОД СГЛАЖИВАНИЯ
    fastSmoothSegmentationMask(maskCanvas) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = maskCanvas.width;
        tempCanvas.height = maskCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Рисуем оригинальную маску
        tempCtx.drawImage(maskCanvas, 0, 0);
        const originalImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const resultImageData = new ImageData(tempCanvas.width, tempCanvas.height);
        
        const data = originalImageData.data;
        const resultData = resultImageData.data;
        
        // БЫСТРОЕ РАЗМЫТИЕ (упрощенное)
        const blurredData = this.fastBlur(originalImageData, 2);
        
        // ОПТИМИЗИРОВАННАЯ ОБРАБОТКА ПИКСЕЛЕЙ
        for (let i = 0; i < data.length; i += 4) {
            const alpha = blurredData[i];
            
            // УПРОЩЕННЫЕ ПАРАМЕТРЫ ДЛЯ СКОРОСТИ
            let finalAlpha;
            if (alpha > 210) {
                finalAlpha = 255;
            } else if (alpha > 120) {
                // Плавный переход с линейной интерполяцией
                const factor = (alpha - 120) / 90;
                finalAlpha = Math.floor(120 + factor * 135);
            } else {
                finalAlpha = 0;
            }
            
            resultData[i] = finalAlpha;
            resultData[i + 1] = finalAlpha;
            resultData[i + 2] = finalAlpha;
            resultData[i + 3] = 255;
        }
        
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = tempCanvas.width;
        resultCanvas.height = tempCanvas.height;
        const resultCtx = resultCanvas.getContext('2d');
        resultCtx.putImageData(resultImageData, 0, 0);
        
        return resultCanvas;
    }

    // БЫСТРОЕ РАЗМЫТИЕ
    fastBlur(imageData, radius) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const result = new Uint8ClampedArray(data.length);
        
        // Простое box blur (быстрее чем Gaussian)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let count = 0;
                
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const nx = Math.max(0, Math.min(width - 1, x + dx));
                        const ny = Math.max(0, Math.min(height - 1, y + dy));
                        const idx = (ny * width + nx) * 4;
                        sum += data[idx];
                        count++;
                    }
                }
                
                const idx = (y * width + x) * 4;
                result[idx] = Math.floor(sum / count);
            }
        }
        
        return result;
    }

    // БЫСТРАЯ FALLBACK СЕГМЕНТАЦИЯ
    fastFallbackSegmentation(videoElement) {
        const startTime = performance.now();
        
        const canvas = document.createElement('canvas');
        const width = canvas.width = 320; // УМЕНЬШАЕМ РАЗРЕШЕНИЕ ДЛЯ СКОРОСТИ
        const height = canvas.height = 240;
        const ctx = canvas.getContext('2d');
        
        // Быстрое масштабирование
        ctx.drawImage(videoElement, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        const mask = new ImageData(width, height);
        
        let personPixels = 0;
        
        // ОПТИМИЗИРОВАННЫЙ АЛГОРИТМ
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // БЫСТРЫЕ ПРОВЕРКИ
            const brightness = (r + g + b) / 3;
            if (brightness < 50 || brightness > 230) continue;
            
            if (g > r * 1.3 && g > b * 1.3) continue;
            
            // УПРОЩЕННАЯ ПРОВЕРКА ЦВЕТА КОЖИ
            if (r > g * 1.1 && r > b * 1.1 && (r - b) > 20 && g > b * 0.8) {
                mask.data[i] = 255;
                mask.data[i + 1] = 255;
                mask.data[i + 2] = 255;
                mask.data[i + 3] = 255;
                personPixels++;
            }
        }
        
        const processingTime = performance.now() - startTime;
        
        return {
            segmentation: { 
                segmentationMask: this.imageDataToCanvas(mask),
                personPixels: personPixels
            },
            processingTime: processingTime,
            isFallback: true
        };
    }

    imageDataToCanvas(imageData) {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    setQuality(quality) {
        this.quality = 'high';
        console.log(`🎯 Режим: ВЫСОКАЯ ПРОИЗВОДИТЕЛЬНОСТЬ`);
    }
}