import AppKit
import AVFoundation
import Foundation

guard CommandLine.arguments.count >= 4 else {
    fputs("Usage: extract-video-frames.swift <video> <output-prefix> <seconds...>\n", stderr)
    exit(2)
}

let videoURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputPrefix = CommandLine.arguments[2]
let times = CommandLine.arguments.dropFirst(3).compactMap(Double.init)
let asset = AVURLAsset(url: videoURL)
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero

for (index, seconds) in times.enumerated() {
    let image = try generator.copyCGImage(
        at: CMTime(seconds: seconds, preferredTimescale: 600),
        actualTime: nil
    )
    let bitmap = NSBitmapImageRep(cgImage: image)
    guard let png = bitmap.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "FrameExport", code: 1)
    }
    let outputURL = URL(fileURLWithPath: "\(outputPrefix)-\(index + 1).png")
    try png.write(to: outputURL)
    print(outputURL.path)
}
