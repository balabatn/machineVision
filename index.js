document.getElementById('imageInput').addEventListener('change', loadImage);

let originalImage, editedImage;

function loadImage(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
            originalImage = img;

            // Display image on both canvases
            displayImage(img, 'originalCanvas');
            displayImage(img, 'editedCanvas');

            // Ensure canvas is ready before OpenCV processes it
            setTimeout(() => {
                let mat = cv.imread('originalCanvas');
                cv.imshow('editedCanvas', mat); // Show copy
                mat.delete();

                // Optional: calculate properties if the function exists
                if (typeof calculateProperties === 'function') {
                    calculateProperties(img, 'originalCanvas', 'editedCanvas');
                }
            }, 100);
        };
        img.src = event.target.result;
    };

    reader.readAsDataURL(file);
}

function displayImage(img, canvasId) {
    const canvas = document.getElementById(canvasId);
    const context = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    context.drawImage(img, 0, 0);
}

let currentAngle = 0;

function rotateRight() {
    currentAngle = (currentAngle + 90) % 360;
    rotateImage(currentAngle);
}

function rotateLeft() {
    currentAngle = (currentAngle - 90 + 360) % 360;
    rotateImage(currentAngle);
}

function rotateImage(angle) {
    let src = cv.imread("originalCanvas");
    let dst = new cv.Mat();

    let center = new cv.Point(src.cols / 2, src.rows / 2);
    let M = cv.getRotationMatrix2D(center, angle, 1);

    // Calculate new bounding box size to fit the rotated image
    let cos = Math.abs(M.doubleAt(0, 0));
    let sin = Math.abs(M.doubleAt(0, 1));
    let newWidth = Math.floor(src.rows * sin + src.cols * cos);
    let newHeight = Math.floor(src.rows * cos + src.cols * sin);

    // Adjust the rotation matrix to take into account translation
    M.doublePtr(0, 2)[0] += (newWidth / 2) - center.x;
    M.doublePtr(1, 2)[0] += (newHeight / 2) - center.y;

    cv.warpAffine(src, dst, M, new cv.Size(newWidth, newHeight), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    cv.imshow("editedCanvas", dst);

    src.delete(); dst.delete(); M.delete();
}


function mirrorVertical() {
    let src = cv.imread("originalCanvas");
    let dst = new cv.Mat();
    cv.flip(src, dst, 0); // Flip around x-axis (vertical flip)
    cv.imshow("editedCanvas", dst);
    src.delete(); dst.delete();
}

function mirrorHorizontal() {
    let src = cv.imread("originalCanvas");
    let dst = new cv.Mat();
    cv.flip(src, dst, 1); // Flip around y-axis (horizontal flip)
    cv.imshow("editedCanvas", dst);
    src.delete(); dst.delete();
}


function showHistogram() {
    const src = cv.imread("originalCanvas");
    const channels = new cv.MatVector();
    cv.split(src, channels); // Split the image into Blue, Green, and Red channels

    const colors = ["blue", "green", "red"];
    const titles = ["Color Histogram : Blue", "Color Histogram : Green", "Color Histogram : Red"];
    const allHistograms = [];

    // Initialize histograms for each channel
    let rgbPixelCount = 0;

    for (let c = 0; c < 3; c++) {
        const channel = channels.get(c);
        const hist = new Array(256).fill(0); // Create histogram for this channel

        // Calculate histogram for each pixel in the channel
        for (let i = 0; i < channel.rows; i++) {
            for (let j = 0; j < channel.cols; j++) {
                const val = channel.ucharPtr(i, j)[0]; // Get pixel value
                hist[val]++; // Increment the histogram count for this value
            }
        }

        allHistograms.push(hist); // Store the histogram for this channel
        channel.delete(); // Release memory for this channel
    }

    // Count RGB pixels excluding pure black and white
    for (let i = 0; i < src.rows; i++) {
        for (let j = 0; j < src.cols; j++) {
            const pixel = src.ucharPtr(i, j);
            const [r, g, b] = [pixel[0], pixel[1], pixel[2]];

            const isBlack = r === 0 && g === 0 && b === 0;
            const isWhite = r === 255 && g === 255 && b === 255;

            if (!isBlack && !isWhite) {
                rgbPixelCount++;
            }
        }
    }

    drawCombinedHistograms(allHistograms, "histogramCanvas", colors, titles, rgbPixelCount);

    channels.delete(); // Release memory for channels
    src.delete(); // Release memory for the image
}



function drawCombinedHistograms(histograms, canvasId, colors, titles, rgbCount) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const paddingLeft = 60;
    const paddingBottom = 40;
    const paddingTop = 30;
    const plotHeight = (canvas.height - paddingTop * 4) / 3;
    const plotWidth = canvas.width - paddingLeft - 20;

    const maxVal = Math.max(...histograms.flat());

    ctx.fillStyle = "black";
    ctx.font = "bold 14px Arial";
    ctx.fillText(`RGB Pixels: ${rgbCount}`, 10, 20);

    for (let c = 0; c < 3; c++) {
        const hist = histograms[c];
        const color = colors[c];
        const title = titles[c];
        const top = paddingTop + c * (plotHeight + paddingTop);
        const yAxisBottom = top + plotHeight;

        // Axes
        ctx.strokeStyle = "black";
        ctx.beginPath();
        ctx.moveTo(paddingLeft, top);
        ctx.lineTo(paddingLeft, yAxisBottom); // Y-axis
        ctx.lineTo(paddingLeft + plotWidth, yAxisBottom); // X-axis
        ctx.stroke();

        // Y ticks
        ctx.font = "10px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (let y = 0; y <= maxVal; y += 500) {
            const yPos = yAxisBottom - (y / maxVal) * (plotHeight - 10);
            ctx.beginPath();
            ctx.moveTo(paddingLeft - 5, yPos);
            ctx.lineTo(paddingLeft, yPos);
            ctx.stroke();
            ctx.fillText(y.toString(), paddingLeft - 8, yPos);
        }

        // X ticks
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (let x = 0; x <= 300; x += 50) {
            const xPos = paddingLeft + (x / 256) * plotWidth;
            ctx.beginPath();
            ctx.moveTo(xPos, yAxisBottom);
            ctx.lineTo(xPos, yAxisBottom + 5);
            ctx.stroke();
            ctx.fillText(x.toString(), xPos, yAxisBottom + 8);
        }

        // X Label
        ctx.font = "12px Arial";
        ctx.fillText("Bins", paddingLeft + plotWidth / 2, yAxisBottom + 25);

        // Y Label
        ctx.save();
        ctx.translate(20, top + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.font = "12px Arial";
        ctx.fillText("Number of Pixels", 0, 0);
        ctx.restore();

        // Title
        ctx.font = "bold 14px Arial";
        ctx.fillStyle = "black";
        ctx.fillText(title, paddingLeft + 10, top - 10);

        // Draw histogram
        ctx.beginPath();
        ctx.moveTo(paddingLeft, yAxisBottom);
        for (let i = 0; i < hist.length; i++) {
            const x = paddingLeft + (i / 256) * plotWidth;
            const y = yAxisBottom - (hist[i] / maxVal) * (plotHeight - 10);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(paddingLeft + plotWidth, yAxisBottom);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "black";
        ctx.stroke();

        // Draw value labels every 20 bins
        ctx.fillStyle = "black";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";

        for (let i = 0; i < hist.length; i += 20) {
            const value = hist[i];
            if (value > 0) {
                const x = paddingLeft + (i / 256) * plotWidth;
                const y = yAxisBottom - (value / maxVal) * (plotHeight - 10);
                ctx.fillText(value.toString(), x, y - 5);
            }
        }
    }
}


function toggleHistogram() {
    const container = document.getElementById('histogramContainer');
    
    if (container.style.display === 'none' || container.style.display === '') {
        container.style.display = 'block';
        showHistogram(); // Automatically draw the histogram when showing
    } else {
        container.style.display = 'none';
    }
}





function binaryVerticalProjection() {
    let src = cv.imread("originalCanvas");
    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
    cv.threshold(src, src, 128, 255, cv.THRESH_BINARY);

    let projection = new Array(src.cols).fill(0);

    for (let i = 0; i < src.rows; i++) {
        for (let j = 0; j < src.cols; j++) {
            if (src.ucharPtr(i, j)[0] === 255) {
                projection[j] = 1; // Mark column as containing white
            }
        }
    }

    alert("Binary Vertical Projection:\n" + projection.join(', '));
    src.delete();
}


function horizontalProjection() {
    let src = cv.imread("originalCanvas");
    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
    cv.threshold(src, src, 128, 255, cv.THRESH_BINARY);
    let projection = new Array(src.rows).fill(0);
    for (let i = 0; i < src.rows; i++) {
        for (let j = 0; j < src.cols; j++) {
            if (src.ucharPtr(i, j)[0] === 255) {
                projection[i]++;
            }
        }
    }
    alert("Horizontal Projection:\n" + projection.join(', '));
    src.delete();
}

function resetImage() {
    displayImage(originalImage, 'editedCanvas');
}

function saveImage() {
    const canvas = document.getElementById('editedCanvas');
    const link = document.createElement('a');
    link.download = 'edited_image.png';
    link.href = canvas.toDataURL();
    link.click();
}

function applySmooth() {
    let src = cv.imread("originalCanvas"); // Read the original image from the canvas
    let dst = new cv.Mat();

    // Apply Gaussian Blur with a kernel size of 5x5
    let ksize = new cv.Size(5, 5); // Kernel size
    cv.GaussianBlur(src, dst, ksize, 0, 0, cv.BORDER_DEFAULT);

    // Display the smoothened image on the edited canvas
    cv.imshow("editedCanvas", dst);

    // Clean up memory
    src.delete();
    dst.delete();
}
