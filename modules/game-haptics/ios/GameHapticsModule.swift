import CoreHaptics
import ExpoModulesCore

public class GameHapticsModule: Module {
  private var engine: CHHapticEngine?

  public func definition() -> ModuleDefinition {
    Name("GameHaptics")

    Function("isSupported") { () -> Bool in
      CHHapticEngine.capabilitiesForHardware().supportsHaptics
    }

    AsyncFunction("play") { (events: [[Double]]) in
      self.play(events)
    }
    .runOnQueue(.main)

    OnDestroy {
      self.engine?.stop()
      self.engine = nil
    }
  }

  private func readyEngine() -> CHHapticEngine? {
    guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return nil }
    if engine == nil {
      guard let created = try? CHHapticEngine() else { return nil }
      created.playsHapticsOnly = true
      created.isAutoShutdownEnabled = true
      created.resetHandler = { [weak created] in
        try? created?.start()
      }
      engine = created
    }
    do {
      try engine?.start()
    } catch {
      engine = nil
      return nil
    }
    return engine
  }

  private func play(_ events: [[Double]]) {
    guard let engine = readyEngine() else { return }
    let hapticEvents = events.compactMap { e -> CHHapticEvent? in
      guard e.count >= 3 else { return nil }
      return CHHapticEvent(
        eventType: .hapticTransient,
        parameters: [
          CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(max(0, min(1, e[1])))),
          CHHapticEventParameter(parameterID: .hapticSharpness, value: Float(max(0, min(1, e[2]))))
        ],
        relativeTime: max(0, e[0])
      )
    }
    guard !hapticEvents.isEmpty,
          let pattern = try? CHHapticPattern(events: hapticEvents, parameters: []),
          let player = try? engine.makePlayer(with: pattern) else { return }
    try? player.start(atTime: CHHapticTimeImmediate)
  }
}
