import AppKit
import AVFoundation
import CoreVideo
import Foundation

guard CommandLine.arguments.count == 8 else {
    fputs("Usage: make-real-ui-video.swift <home.png> <request.png> <rider-sos.png> <agency-sos.png> <agency.png> <narration.aiff> <output.mp4>\n", stderr)
    exit(2)
}

let imageURLs = CommandLine.arguments[1...5].map { URL(fileURLWithPath: $0) }
let narrationURL = URL(fileURLWithPath: CommandLine.arguments[6])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[7])
let images = imageURLs.compactMap(NSImage.init(contentsOf:))
guard images.count == 5 else {
    fputs("Unable to load all interface screenshots.\n", stderr)
    exit(3)
}

let audioAsset = AVURLAsset(url: narrationURL)
let narrationDuration = audioAsset.duration.seconds
let duration = max(30.0, narrationDuration + 1.0)
let width = 1280
let height = 720
let fps = 30
let frameCount = Int(ceil(duration * Double(fps)))
let sceneCount = 7
let sceneDuration = duration / Double(sceneCount)
let fadeDuration = 0.45

let silentURL = outputURL.deletingPathExtension().appendingPathExtension("silent.mp4")
try? FileManager.default.removeItem(at: silentURL)
try? FileManager.default.removeItem(at: outputURL)

let writer = try AVAssetWriter(outputURL: silentURL, fileType: .mp4)
let input = AVAssetWriterInput(
    mediaType: .video,
    outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
            AVVideoAverageBitRateKey: 6_000_000,
            AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        ],
    ]
)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
    ]
)
guard writer.canAdd(input) else {
    fputs("Unable to configure video writer.\n", stderr)
    exit(4)
}
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

let paper = NSColor(calibratedRed: 0.985, green: 0.975, blue: 0.945, alpha: 1)
let ink = NSColor(calibratedRed: 0.12, green: 0.105, blue: 0.085, alpha: 1)
let muted = NSColor(calibratedRed: 0.40, green: 0.37, blue: 0.33, alpha: 1)
let orange = NSColor(calibratedRed: 0.91, green: 0.46, blue: 0.09, alpha: 1)
let red = NSColor(calibratedRed: 0.78, green: 0.16, blue: 0.16, alpha: 1)

func drawText(
    _ text: String,
    in rect: CGRect,
    size: CGFloat,
    weight: NSFont.Weight = .regular,
    color: NSColor = ink,
    alignment: NSTextAlignment = .left
) {
    let style = NSMutableParagraphStyle()
    style.alignment = alignment
    style.lineBreakMode = .byWordWrapping
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: color,
        .paragraphStyle: style,
    ]
    (text as NSString).draw(in: rect, withAttributes: attributes)
}

func drawImage(_ image: NSImage, in bounds: CGRect, maxWidth: CGFloat, maxHeight: CGFloat) {
    let ratio = min(maxWidth / image.size.width, maxHeight / image.size.height)
    let size = CGSize(width: image.size.width * ratio, height: image.size.height * ratio)
    let rect = CGRect(
        x: bounds.midX - size.width / 2,
        y: bounds.midY - size.height / 2,
        width: size.width,
        height: size.height
    )
    NSColor(calibratedWhite: 0, alpha: 0.12).setFill()
    NSBezierPath(roundedRect: rect.insetBy(dx: -10, dy: -10), xRadius: 20, yRadius: 20).fill()
    image.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1)
}

func drawScene(_ index: Int, alpha: CGFloat, in context: CGContext) {
    context.saveGState()
    context.setAlpha(alpha)
    let canvas = CGRect(x: 0, y: 0, width: width, height: height)
    context.setFillColor(paper.cgColor)
    context.fill(canvas)

    switch index {
    case 0:
        context.setFillColor(orange.cgColor)
        context.fill(CGRect(x: 0, y: 0, width: 18, height: height))
        drawText("AccessRide", in: CGRect(x: 92, y: 405, width: 1096, height: 100), size: 72, weight: .bold)
        drawText("Accessible transportation. Connected support.", in: CGRect(x: 96, y: 330, width: 1080, height: 55), size: 34, weight: .semibold, color: muted)
        drawText("More than 1 in 4 U.S. adults has a disability", in: CGRect(x: 96, y: 208, width: 1080, height: 55), size: 30, weight: .bold, color: orange)
        drawText("18.6 million Americans report travel-limiting disabilities", in: CGRect(x: 96, y: 150, width: 1080, height: 48), size: 25, color: muted)
        drawText("Sources: CDC and U.S. DOT Bureau of Transportation Statistics", in: CGRect(x: 96, y: 52, width: 1080, height: 30), size: 16, color: muted)
    case 1:
        drawText("Independent riders need a simple way to request transportation.", in: CGRect(x: 60, y: 440, width: 620, height: 130), size: 38, weight: .bold)
        drawText("The Rider app is designed for clear, accessible, repeated use.", in: CGRect(x: 60, y: 320, width: 570, height: 100), size: 25, color: muted)
        drawImage(images[0], in: CGRect(x: 720, y: 30, width: 500, height: 660), maxWidth: 330, maxHeight: 660)
    case 2:
        drawText("Book one-way or round-trip rides.", in: CGRect(x: 60, y: 462, width: 580, height: 110), size: 39, weight: .bold)
        drawText("Enter pickup, destination, travel time, return time, and accessibility needs. Voice input is available.", in: CGRect(x: 60, y: 280, width: 580, height: 165), size: 25, color: muted)
        drawImage(images[1], in: CGRect(x: 720, y: 30, width: 500, height: 660), maxWidth: 300, maxHeight: 660)
    case 3:
        drawText("Help is one press away.", in: CGRect(x: 60, y: 470, width: 570, height: 80), size: 42, weight: .bold)
        drawText("Press and hold SOS to share the rider’s location with the transportation agency.", in: CGRect(x: 60, y: 310, width: 570, height: 145), size: 26, color: muted)
        drawText("Call 911 for immediate danger.", in: CGRect(x: 60, y: 225, width: 570, height: 50), size: 24, weight: .bold, color: red)
        drawImage(images[2], in: CGRect(x: 720, y: 30, width: 500, height: 660), maxWidth: 330, maxHeight: 660)
    case 4:
        drawText("The agency receives the SOS in real time.", in: CGRect(x: 70, y: 630, width: 1140, height: 55), size: 34, weight: .bold)
        drawImage(images[3], in: CGRect(x: 80, y: 35, width: 1120, height: 565), maxWidth: 1080, maxHeight: 560)
    case 5:
        drawText("One shared view for dispatch and response.", in: CGRect(x: 70, y: 630, width: 1140, height: 55), size: 34, weight: .bold)
        drawImage(images[4], in: CGRect(x: 80, y: 35, width: 1120, height: 565), maxWidth: 1080, maxHeight: 560)
    default:
        context.setFillColor(orange.cgColor)
        context.fill(CGRect(x: 0, y: 0, width: width, height: 16))
        drawText("AccessRide", in: CGRect(x: 100, y: 390, width: 1080, height: 95), size: 70, weight: .bold, alignment: .center)
        drawText("Reliable rides. Faster response. Greater independence.", in: CGRect(x: 130, y: 310, width: 1020, height: 60), size: 30, weight: .semibold, color: muted, alignment: .center)
        drawText("In immediate danger, always call 911.", in: CGRect(x: 180, y: 205, width: 920, height: 45), size: 23, weight: .bold, color: red, alignment: .center)
    }
    context.restoreGState()
}

for frame in 0..<frameCount {
    while !input.isReadyForMoreMediaData {
        Thread.sleep(forTimeInterval: 0.002)
    }
    var pixelBuffer: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pixelBuffer)
    guard let buffer = pixelBuffer else { continue }
    CVPixelBufferLockBaseAddress(buffer, [])
    guard let context = CGContext(
        data: CVPixelBufferGetBaseAddress(buffer),
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue
            | CGImageAlphaInfo.premultipliedFirst.rawValue
    ) else {
        CVPixelBufferUnlockBaseAddress(buffer, [])
        continue
    }

    let graphicsContext = NSGraphicsContext(cgContext: context, flipped: false)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = graphicsContext

    let seconds = Double(frame) / Double(fps)
    let scenePosition = seconds / sceneDuration
    let scene = min(sceneCount - 1, Int(scenePosition))
    let withinScene = seconds - Double(scene) * sceneDuration
    drawScene(scene, alpha: 1, in: context)
    if withinScene > sceneDuration - fadeDuration, scene < sceneCount - 1 {
        let progress = CGFloat((withinScene - (sceneDuration - fadeDuration)) / fadeDuration)
        drawScene(scene + 1, alpha: progress, in: context)
    }

    NSGraphicsContext.restoreGraphicsState()
    CVPixelBufferUnlockBaseAddress(buffer, [])
    adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(frame), timescale: CMTimeScale(fps)))
}

input.markAsFinished()
let writerSemaphore = DispatchSemaphore(value: 0)
writer.finishWriting { writerSemaphore.signal() }
writerSemaphore.wait()
guard writer.status == .completed else {
    fputs("Silent video export failed: \(writer.error?.localizedDescription ?? "unknown error")\n", stderr)
    exit(5)
}

let videoAsset = AVURLAsset(url: silentURL)
let composition = AVMutableComposition()
guard
    let compositionVideo = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
    let sourceVideo = videoAsset.tracks(withMediaType: .video).first,
    let compositionAudio = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid),
    let sourceAudio = audioAsset.tracks(withMediaType: .audio).first
else {
    fputs("Unable to prepare final audio/video composition.\n", stderr)
    exit(6)
}

try compositionVideo.insertTimeRange(
    CMTimeRange(start: .zero, duration: videoAsset.duration),
    of: sourceVideo,
    at: .zero
)
try compositionAudio.insertTimeRange(
    CMTimeRange(start: .zero, duration: min(audioAsset.duration, videoAsset.duration)),
    of: sourceAudio,
    at: CMTime(seconds: 0.45, preferredTimescale: 600)
)

guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
    fputs("Unable to create final exporter.\n", stderr)
    exit(7)
}
exporter.outputURL = outputURL
exporter.outputFileType = .mp4
exporter.shouldOptimizeForNetworkUse = true
let exportSemaphore = DispatchSemaphore(value: 0)
exporter.exportAsynchronously { exportSemaphore.signal() }
exportSemaphore.wait()
try? FileManager.default.removeItem(at: silentURL)

guard exporter.status == .completed else {
    fputs("Final export failed: \(exporter.error?.localizedDescription ?? "unknown error")\n", stderr)
    exit(8)
}

print(outputURL.path)
