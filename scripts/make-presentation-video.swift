import AppKit
import AVFoundation
import CoreVideo
import Foundation

struct Manifest: Decodable {
    struct Slide: Decodable {
        let image: String
        let audio: String
    }

    let slides: [Slide]
}

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: make-presentation-video.swift <manifest.json> <output.mp4>\n", stderr)
    exit(2)
}

let manifestURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let manifest = try JSONDecoder().decode(
    Manifest.self,
    from: Data(contentsOf: manifestURL)
)

guard !manifest.slides.isEmpty else {
    fputs("The presentation manifest has no slides.\n", stderr)
    exit(3)
}

let images = manifest.slides.compactMap { NSImage(contentsOfFile: $0.image) }
let audioAssets = manifest.slides.map {
    AVURLAsset(url: URL(fileURLWithPath: $0.audio))
}
guard images.count == manifest.slides.count else {
    fputs("Unable to load all presentation slides.\n", stderr)
    exit(4)
}

let leadIn = 0.45
let trailingPause = 0.65
let fadeDuration = 0.4
let segmentDurations = audioAssets.map {
    max(2.0, $0.duration.seconds + leadIn + trailingPause)
}
let startTimes = segmentDurations.dropLast().reduce(into: [0.0]) { starts, duration in
    starts.append(starts.last! + duration)
}
let totalDuration = segmentDurations.reduce(0, +)

guard totalDuration >= 300, totalDuration <= 360 else {
    fputs("Expected a 5-6 minute presentation, got \(totalDuration) seconds.\n", stderr)
    exit(5)
}

let width = 1280
let height = 720
let fps = 15
let frameCount = Int(ceil(totalDuration * Double(fps)))
let silentURL = outputURL
    .deletingPathExtension()
    .appendingPathExtension("silent.mp4")

try? FileManager.default.removeItem(at: silentURL)
try? FileManager.default.removeItem(at: outputURL)

let writer = try AVAssetWriter(outputURL: silentURL, fileType: .mp4)
let videoInput = AVAssetWriterInput(
    mediaType: .video,
    outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
            AVVideoAverageBitRateKey: 4_000_000,
            AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        ],
    ]
)
videoInput.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: videoInput,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
    ]
)
guard writer.canAdd(videoInput) else {
    fputs("Unable to configure the video writer.\n", stderr)
    exit(6)
}
writer.add(videoInput)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

func slideIndex(at seconds: Double) -> Int {
    for index in startTimes.indices.reversed() where seconds >= startTimes[index] {
        return index
    }
    return 0
}

func draw(_ image: NSImage, alpha: CGFloat) {
    image.draw(
        in: CGRect(x: 0, y: 0, width: width, height: height),
        from: .zero,
        operation: .sourceOver,
        fraction: alpha
    )
}

for frame in 0..<frameCount {
    while !videoInput.isReadyForMoreMediaData {
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

    NSColor(calibratedRed: 0.985, green: 0.975, blue: 0.945, alpha: 1).setFill()
    NSBezierPath.fill(CGRect(x: 0, y: 0, width: width, height: height))

    let seconds = Double(frame) / Double(fps)
    let index = slideIndex(at: seconds)
    draw(images[index], alpha: 1)
    if index < images.count - 1 {
        let elapsed = seconds - startTimes[index]
        let fadeStart = segmentDurations[index] - fadeDuration
        if elapsed > fadeStart {
            let progress = min(1, CGFloat((elapsed - fadeStart) / fadeDuration))
            draw(images[index + 1], alpha: progress)
        }
    }

    NSGraphicsContext.restoreGraphicsState()
    CVPixelBufferUnlockBaseAddress(buffer, [])
    adaptor.append(
        buffer,
        withPresentationTime: CMTime(
            value: CMTimeValue(frame),
            timescale: CMTimeScale(fps)
        )
    )
}

videoInput.markAsFinished()
let writerSemaphore = DispatchSemaphore(value: 0)
writer.finishWriting { writerSemaphore.signal() }
writerSemaphore.wait()
guard writer.status == .completed else {
    fputs("Silent video export failed: \(writer.error?.localizedDescription ?? "unknown error")\n", stderr)
    exit(7)
}

let silentAsset = AVURLAsset(url: silentURL)
let composition = AVMutableComposition()
guard
    let compositionVideo = composition.addMutableTrack(
        withMediaType: .video,
        preferredTrackID: kCMPersistentTrackID_Invalid
    ),
    let sourceVideo = silentAsset.tracks(withMediaType: .video).first,
    let compositionAudio = composition.addMutableTrack(
        withMediaType: .audio,
        preferredTrackID: kCMPersistentTrackID_Invalid
    )
else {
    fputs("Unable to prepare the final composition.\n", stderr)
    exit(8)
}

try compositionVideo.insertTimeRange(
    CMTimeRange(start: .zero, duration: silentAsset.duration),
    of: sourceVideo,
    at: .zero
)
for index in audioAssets.indices {
    guard let sourceAudio = audioAssets[index].tracks(withMediaType: .audio).first else {
        fputs("Missing narration track for slide \(index + 1).\n", stderr)
        exit(9)
    }
    try compositionAudio.insertTimeRange(
        CMTimeRange(start: .zero, duration: audioAssets[index].duration),
        of: sourceAudio,
        at: CMTime(
            seconds: startTimes[index] + leadIn,
            preferredTimescale: 600
        )
    )
}

guard let exporter = AVAssetExportSession(
    asset: composition,
    presetName: AVAssetExportPresetHighestQuality
) else {
    fputs("Unable to create the final exporter.\n", stderr)
    exit(10)
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
    exit(11)
}

print(
    String(
        format: "Created %@ with %d slides, duration %.2f seconds.",
        outputURL.path,
        manifest.slides.count,
        totalDuration
    )
)
