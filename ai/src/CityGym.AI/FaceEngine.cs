using OpenCvSharp;

namespace CityGym.AI;

public sealed record FaceFeature(string Model, string Pipeline, float[] Vector, float DetectionScore);
public sealed record GalleryEntry(string FaceInfoId, FaceFeature Feature);
public sealed record MatchResult(bool Found, string? FaceInfoId, double? Score);
public sealed class FaceInputException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

/// <summary>One CPU engine, serialized access to native models. No database or HTTP dependency.</summary>
public sealed class FaceEngine : IDisposable
{
    public const string Model = "opencv-sface-2021dec";
    public const string Pipeline = "yunet2023mar-similarity5-sface128-v1";
    private readonly FaceDetectorYN detector;
    private readonly SFaceExtractor recognizer;
    private readonly object gate = new();
    private bool disposed;

    public FaceEngine(string modelDirectory)
    {
        var detection = Path.Combine(modelDirectory, "face_detection_yunet_2023mar.onnx");
        var recognition = Path.Combine(modelDirectory, "face_recognition_sface_2021dec.onnx");
        if (!File.Exists(detection) || !File.Exists(recognition))
            throw new FileNotFoundException("Run ai/download-models.ps1 before starting the engine.");
        detector = FaceDetectorYN.Create(detection, "", new Size(640, 640), 0.9f);
        try { recognizer = new SFaceExtractor(recognition); }
        catch { detector.Dispose(); throw; }
    }

    public FaceFeature Extract(byte[] imageBytes)
    {
        if (imageBytes.Length == 0 || imageBytes.Length > 10 * 1024 * 1024)
            throw new FaceInputException("INVALID_IMAGE", "Image must be between 1 byte and 10 MB.");
        lock (gate)
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            using var image = Cv2.ImDecode(imageBytes, ImreadModes.Color);
            if (image.Empty()) throw new FaceInputException("INVALID_IMAGE", "Cannot decode image.");
            if ((long)image.Width * image.Height > 24_000_000)
                throw new FaceInputException("IMAGE_TOO_LARGE", "Maximum decoded size is 24 megapixels.");
            using var scaled = new Mat();
            var scale = Math.Min(1d, 640d / Math.Max(image.Width, image.Height));
            Cv2.Resize(image, scaled, new Size(Math.Max(1, (int)(image.Width * scale)), Math.Max(1, (int)(image.Height * scale))));
            using var canvas = new Mat(640, 640, MatType.CV_8UC3, Scalar.Black);
            using (var area = new Mat(canvas, new Rect(0, 0, scaled.Width, scaled.Height))) scaled.CopyTo(area);
            using var faces = new Mat();
            detector.Detect(canvas, faces);
            if (faces.Rows == 0) throw new FaceInputException("NO_FACE", "No face detected.");
            if (faces.Rows != 1) throw new FaceInputException("MULTIPLE_FACES", "Exactly one face is required.");
            using var face = faces.Row(0);
            using var aligned = new Mat();
            recognizer.AlignCrop(canvas, face, aligned);
            using var feature = recognizer.Feature(aligned);
            if (feature.Total() != 128) throw new InvalidOperationException("Unexpected SFace dimension.");
            using var flat = feature.Reshape(1, 1);
            var vector = Enumerable.Range(0, 128).Select(i => flat.At<float>(0, i)).ToArray();
            return new FaceFeature(Model, Pipeline, FeatureMath.Normalize(vector), faces.At<float>(0, 14));
        }
    }

    public void Dispose()
    {
        lock (gate)
        {
            if (disposed) return;
            disposed = true;
            recognizer.Dispose();
            detector.Dispose();
        }
    }
}
