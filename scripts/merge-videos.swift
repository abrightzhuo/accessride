import AVFoundation
import Foundation

guard CommandLine.arguments.count == 4 else {
    fputs("Usage: merge-videos.swift <first.mp4> <second.mp4> <output.mp4>\n", stderr)
    exit(2)
}

let firstURL = URL(fileURLWithPath: CommandLine.arguments[1])
let secondURL = URL(fileURLWithPath: CommandLine.arguments[2])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[3])
let firstAsset = AVURLAsset(url: firstURL)
let secondAsset = AVURLAsset(url: secondURL)
let composition = AVMutableComposition()

guard
    let videoTrack = composition.addMutableTrack(
        withMediaType: .video,
        preferredTrackID: kCMPersistentTrackID_Invalid
    ),
    let firstVideo = firstAsset.tracks(withMediaType: .video).first,
    let secondVideo = secondAsset.tracks(withMediaType: .video).first
else {
    fputs("Both input files must contain video.\n", stderr)
    exit(3)
}

let firstDuration = firstAsset.duration
let secondDuration = secondAsset.duration
let totalDuration = CMTimeAdd(firstDuration, secondDuration)

try videoTrack.insertTimeRange(
    CMTimeRange(start: .zero, duration: firstDuration),
    of: firstVideo,
    at: .zero
)
try videoTrack.insertTimeRange(
    CMTimeRange(start: .zero, duration: secondDuration),
    of: secondVideo,
    at: firstDuration
)

let fadeDuration = CMTime(seconds: 0.4, preferredTimescale: 600)
let firstFadeStart = CMTimeSubtract(firstDuration, fadeDuration)
let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
layerInstruction.setTransform(firstVideo.preferredTransform, at: .zero)
layerInstruction.setOpacityRamp(
    fromStartOpacity: 1,
    toEndOpacity: 0,
    timeRange: CMTimeRange(start: firstFadeStart, duration: fadeDuration)
)
layerInstruction.setTransform(secondVideo.preferredTransform, at: firstDuration)
layerInstruction.setOpacityRamp(
    fromStartOpacity: 0,
    toEndOpacity: 1,
    timeRange: CMTimeRange(start: firstDuration, duration: fadeDuration)
)

let instruction = AVMutableVideoCompositionInstruction()
instruction.timeRange = CMTimeRange(start: .zero, duration: totalDuration)
instruction.layerInstructions = [layerInstruction]

let videoComposition = AVMutableVideoComposition()
videoComposition.instructions = [instruction]
videoComposition.renderSize = CGSize(width: 1280, height: 720)
videoComposition.frameDuration = CMTime(value: 1, timescale: 30)

var audioMix: AVAudioMix?
if
    let audioTrack = composition.addMutableTrack(
        withMediaType: .audio,
        preferredTrackID: kCMPersistentTrackID_Invalid
    ),
    let firstAudio = firstAsset.tracks(withMediaType: .audio).first,
    let secondAudio = secondAsset.tracks(withMediaType: .audio).first
{
    try audioTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: firstDuration),
        of: firstAudio,
        at: .zero
    )
    try audioTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: secondDuration),
        of: secondAudio,
        at: firstDuration
    )

    let audioParameters = AVMutableAudioMixInputParameters(track: audioTrack)
    audioParameters.setVolumeRamp(
        fromStartVolume: 1,
        toEndVolume: 0,
        timeRange: CMTimeRange(start: firstFadeStart, duration: fadeDuration)
    )
    audioParameters.setVolumeRamp(
        fromStartVolume: 0,
        toEndVolume: 1,
        timeRange: CMTimeRange(start: firstDuration, duration: fadeDuration)
    )
    let mix = AVMutableAudioMix()
    mix.inputParameters = [audioParameters]
    audioMix = mix
}

try? FileManager.default.removeItem(at: outputURL)
guard let exporter = AVAssetExportSession(
    asset: composition,
    presetName: AVAssetExportPresetHighestQuality
) else {
    fputs("Unable to create video exporter.\n", stderr)
    exit(4)
}

exporter.outputURL = outputURL
exporter.outputFileType = .mp4
exporter.shouldOptimizeForNetworkUse = true
exporter.videoComposition = videoComposition
exporter.audioMix = audioMix

let semaphore = DispatchSemaphore(value: 0)
exporter.exportAsynchronously {
    semaphore.signal()
}
semaphore.wait()

if exporter.status != .completed {
    fputs("Export failed: \(exporter.error?.localizedDescription ?? "unknown error")\n", stderr)
    exit(5)
}

print(outputURL.path)
