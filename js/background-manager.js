class BackgroundManager {
    constructor() {
        this.backgroundImages = {};
        this.imagesLoaded = false;
        this.loadedCount = 0;
        this.totalCount = 7;
        this.videoLoaded = false;
        this.videoElement = null;
        this.init();
    }

    init() {
        this.preloadImages();
        this.setupVideoElement();
    }

    setupVideoElement() {
        this.videoElement = document.getElementById('backgroundVideo');
        if (!this.videoElement) {
            console.log('⚠️ Видео элемент не найден, создаем новый');
            this.videoElement = document.createElement('video');
            this.videoElement.id = 'backgroundVideo';
            this.videoElement.loop = true;
            this.videoElement.muted = true;
            this.videoElement.playsinline = true;
            this.videoElement.style.display = 'none';
            
            const source = document.createElement('source');
            source.src = './backgrounds/backgroundVideo.mp4';
            source.type = 'video/mp4';
            this.videoElement.appendChild(source);
            
            document.body.appendChild(this.videoElement);
        }
    }

    preloadImages() {
        const imagePaths = {
            'image1': './backgrounds/background1.jpg',
            'image2': './backgrounds/background2.jpg',
            'image3': './backgrounds/background3.jpg', 
            'image4': './backgrounds/background4.jpg',
            'image5': './backgrounds/background5.jpg',
            'image6': './backgrounds/background6.jpg',
            'image7': './backgrounds/background7.jpg'
        };

        Object.entries(imagePaths).forEach(([key, path]) => {
            const img = new Image();
            
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                this.loadedCount++;
                this.backgroundImages[key] = img;
                console.log(`✅ Загружено: ${key} - ${path} (${img.width}x${img.height})`);
                
                if (this.loadedCount === this.totalCount) {
                    this.imagesLoaded = true;
                    console.log('🎉 Все фоновые изображения загружены!');
                }
            };
            
            img.onerror = (error) => {
                console.error(`❌ Ошибка загрузки: ${path}`, error);
                this.loadedCount++;
                this.createFallbackImage(key);
                
                if (this.loadedCount === this.totalCount) {
                    this.imagesLoaded = true;
                }
            };
            
            img.src = path;
        });
    }

    createFallbackImage(key) {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        const colors = {
            'image1': '#FF6B6B', 'image2': '#4ECDC4', 'image3': '#45B7D1',
            'image4': '#96CEB4', 'image5': '#FFEAA7', 'image6': '#DDA0DD', 'image7': '#98D8C8'
        };
        
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, colors[key]);
        gradient.addColorStop(1, this.lightenColor(colors[key], 30));
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const img = new Image();
        img.onload = () => {
            this.backgroundImages[key] = img;
        };
        img.src = canvas.toDataURL();
    }

    lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return "#" + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
    }

    getBackgroundImage(backgroundType) {
        return this.backgroundImages[backgroundType];
    }

    isImageLoaded(backgroundType) {
        const img = this.backgroundImages[backgroundType];
        return img && img.complete && img.naturalWidth > 0;
    }

    getVideoElement() {
        return this.videoElement;
    }

    // НЕБЛОКИРУЮЩАЯ загрузка видео
    async preloadVideo() {
        return new Promise((resolve) => {
            if (!this.videoElement) {
                console.log('⚠️ Видео элемент не найден');
                resolve(false);
                return;
            }

            // Если видео уже загружено
            if (this.videoElement.readyState >= 3) {
                console.log('✅ Видео уже загружено');
                this.videoLoaded = true;
                resolve(true);
                return;
            }

            // Таймаут на случай если видео не загрузится
            const timeout = setTimeout(() => {
                console.log('⚠️ Таймаут загрузки видео');
                this.videoElement.removeEventListener('loadeddata', onLoaded);
                this.videoElement.removeEventListener('error', onError);
                resolve(false);
            }, 5000);

            const onLoaded = () => {
                clearTimeout(timeout);
                console.log('✅ Видео фон загружено');
                this.videoLoaded = true;
                resolve(true);
            };

            const onError = (error) => {
                clearTimeout(timeout);
                console.log('⚠️ Видео не загружено:', error);
                resolve(false);
            };

            const onCanPlay = () => {
                clearTimeout(timeout);
                console.log('✅ Видео готово к воспроизведению');
                this.videoLoaded = true;
                this.videoElement.removeEventListener('canplay', onCanPlay);
                resolve(true);
            };

            this.videoElement.addEventListener('loadeddata', onLoaded, { once: true });
            this.videoElement.addEventListener('canplay', onCanPlay, { once: true });
            this.videoElement.addEventListener('error', onError, { once: true });

            // Пытаемся загрузить видео
            this.videoElement.load();
            
            // Альтернативный способ для некоторых браузеров
            this.videoElement.preload = 'auto';
        });
    }

    isVideoLoaded() {
        return this.videoLoaded && this.videoElement && this.videoElement.readyState >= 2;
    }

    // Новый метод для перезагрузки видео
    reloadVideo() {
        if (this.videoElement) {
            this.videoElement.load();
            this.videoLoaded = false;
        }
    }
}