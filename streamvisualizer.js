const WIDTH = 308;
const HEIGHT = 231;

// Interesting parameters to tweak!
const SMOOTHING = 0.8;
const FFT_SIZE = 2048;

export function StreamVisualizer(remoteStream, canvas) {
    console.log('Creating StreamVisualizer with remoteStream and canvas: ',
        remoteStream, canvas);
    this.canvas = canvas;
    this.drawContext = this.canvas.getContext('2d');

    // cope with browser differences
    if (typeof AudioContext === 'function') {
        this.context = new AudioContext();
    } else if (typeof webkitAudioContext === 'function') {
        this.context = new webkitAudioContext(); // eslint-disable-line new-cap
    } else {
        alert('Sorry! Web Audio is not supported by this browser');
    }

    // Create a MediaStreamAudioSourceNode from the remoteStream
    this.source = this.context.createMediaStreamSource(remoteStream);
    console.log('Created Web Audio source from remote stream: ', this.source);

    this.analyser = this.context.createAnalyser();
//  this.analyser.connect(this.context.destination);
    this.analyser.minDecibels = -140;
    this.analyser.maxDecibels = 0;
    this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
    this.times = new Uint8Array(this.analyser.frequencyBinCount);

    this.source.connect(this.analyser);

    this.startTime = 0;
    this.startOffset = 0;
}

StreamVisualizer.prototype.start = function() {
    requestAnimationFrame(this.draw.bind(this));
};

StreamVisualizer.prototype.draw = function() {
    let barWidth;
    let offset;
    let height;
    let percent;
    let value;
    this.analyser.smoothingTimeConstant = SMOOTHING;
    this.analyser.fftSize = FFT_SIZE;

    // Get the frequency data from the currently playing music
    this.analyser.getByteFrequencyData(this.freqs);
    this.analyser.getByteTimeDomainData(this.times);


    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    // Draw the frequency domain chart.
    for (let i = 0; i < this.analyser.frequencyBinCount; i++) {
        value = this.freqs[i];
        percent = value / 256;
        height = HEIGHT * percent;
        offset = HEIGHT - height - 1;
        barWidth = WIDTH / this.analyser.frequencyBinCount;
        let hue = i/this.analyser.frequencyBinCount * 360;
        this.drawContext.fillStyle = 'hsl(' + hue + ', 100%, 50%)';
        this.drawContext.fillRect(i * barWidth, offset, barWidth, height);
    }

    // Draw the time domain chart.
    for (let i = 0; i < this.analyser.frequencyBinCount; i++) {
        value = this.times[i];
        percent = value / 256;
        height = HEIGHT * percent;
        offset = HEIGHT - height - 1;
        barWidth = WIDTH/this.analyser.frequencyBinCount;
        this.drawContext.fillStyle = 'white';
        this.drawContext.fillRect(i * barWidth, offset, 1, 2);
    }

    requestAnimationFrame(this.draw.bind(this));
};

StreamVisualizer.prototype.getFrequencyValue = function(freq) {
    let nyquist = this.context.sampleRate/2;
    let index = Math.round(freq/nyquist * this.freqs.length);
    return this.freqs[index];
};