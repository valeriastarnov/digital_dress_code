class Segmentator {
    constructor() {
        this.model = null;
        this.isModelLoaded = false;
        this.lastResults = null;
        this.useFallback = false;
        this.quality = 'fast';
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
                
                // МАКСИМАЛЬНО БЫСТРЫЕ НАСТРОЙКИ
                this.model.setOptions({
                    modelSelection: 0, // САМАЯ БЫСТРАЯ МОДЕЛЬ
                    selfieMode: false,
                });
                
                this.model.onResults((results) => {
                    this.lastResults = results;
                    this.processingFrame = false;
                });
                
                this.isModelLoaded = true;
                console.log('✅ MediaPipe загружена! (СУПЕР БЫСТРЫЙ РЕЖИМ)');
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
            return this.ultraFastFallbackSegmentation(videoElement);
        }

        if (videoElement.readyState < 2) {
            return { segmentation: null, processingTime: 0 };
        }

        try {
            this.processingFrame = true;
            const startTime = performance.now();
            await this.model.send({image: videoElement});
            const processingTime = performance.now() - startTime;
            
            return {
                segmentation: this.lastResults,
                processingTime: processingTime
            };
            
        } catch (error) {
            console.error('❌ Ошибка сегментации MediaPipe:', error);
            this.processingFrame = false;
            return this.ultraFastFallbackSegmentation(videoElement);
        }
    }

    // УЛЬТРА-БЫСТРАЯ FALLBACK СЕГМЕНТАЦИЯ
    ultraFastFallbackSegmentation(videoElement) {
        const startTime = performance.now();
        
        // МИНИМАЛЬНОЕ РАЗРЕШЕНИЕ ДЛЯ МАКСИМАЛЬНОЙ СКОРОСТИ
        const canvas = document.createElement('canvas');
        const width = canvas.width = 64;
        const height = canvas.height = 48;
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(videoElement, 0, 0, width, height);
        
        const processingTime = performance.now() - startTime;
        
        // ПРОСТАЯ МАСКА (центр кадра - человек)
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');
        
        maskCtx.fillStyle = 'black';
        maskCtx.fillRect(0, 0, width, height);
        
        maskCtx.fillStyle = 'white';
        const personWidth = width * 0.6;
        const personHeight = height * 0.7;
        const personX = (width - personWidth) / 2;
        const personY = (height - personHeight) / 2;
        maskCtx.fillRect(personX, personY, personWidth, personHeight);
        
        const personPixels = personWidth * personHeight;
        
        return {
            segmentation: { 
                segmentationMask: maskCanvas,
                personPixels: personPixels
            },
            processingTime: processingTime,
            isFallback: true
        };
    }

    setQuality(quality) {
        this.quality = 'ultra-fast';
        console.log(`🚀 Режим: УЛЬТРА БЫСТРАЯ СЕГМЕНТАЦИЯ`);
    }
}