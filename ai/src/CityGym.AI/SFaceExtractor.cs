using OpenCvSharp;
using OpenCvSharp.Dnn;

namespace CityGym.AI;

/// <summary>SFace ONNX through OpenCV DNN; the pinned NuGet release lacks the FaceRecognizerSF wrapper.</summary>
internal sealed class SFaceExtractor : IDisposable
{
    private readonly Net network;
    // Canonical five landmarks used by OpenCV SFace, in YuNet landmark order.
    private static readonly Point2d[] TargetPoints =
    [new(38.2946, 51.6963), new(73.5318, 51.5014), new(56.0252, 71.7366), new(41.5493, 92.3655), new(70.7299, 92.2041)];

    public SFaceExtractor(string path)
    {
        network = CvDnn.ReadNetFromOnnx(path) ?? throw new InvalidOperationException("Cannot load SFace model.");
        network.SetPreferableBackend(Backend.OPENCV);
        network.SetPreferableTarget(Target.CPU);
    }

    public void AlignCrop(Mat image, Mat face, Mat aligned)
    {
        var source = Enumerable.Range(0, 5)
            .Select(i => new Point2d(face.At<float>(0, 4 + i * 2), face.At<float>(0, 5 + i * 2))).ToArray();
        using var transform = SimilarityTransform(source, TargetPoints);
        Cv2.WarpAffine(image, aligned, transform, new Size(112, 112), InterpolationFlags.Linear, BorderTypes.Constant);
    }

    // Least-squares, orientation-preserving similarity: x'=a*x-b*y+tx, y'=b*x+a*y+ty.
    internal static Mat SimilarityTransform(Point2d[] source, Point2d[] target)
    {
        if (source.Length != 5 || target.Length != 5 || source.Concat(target).Any(p => !double.IsFinite(p.X) || !double.IsFinite(p.Y)))
            throw new FaceInputException("INVALID_LANDMARKS", "Five finite landmarks are required.");
        double sx = source.Average(p => p.X), sy = source.Average(p => p.Y);
        double dx = target.Average(p => p.X), dy = target.Average(p => p.Y);
        double denominator = 0, real = 0, imaginary = 0;
        for (var i = 0; i < 5; i++)
        {
            var x = source[i].X - sx; var y = source[i].Y - sy;
            var u = target[i].X - dx; var v = target[i].Y - dy;
            denominator += x * x + y * y;
            real += x * u + y * v;
            imaginary += x * v - y * u;
        }
        if (denominator < 1e-12) throw new FaceInputException("INVALID_LANDMARKS", "Degenerate face landmarks.");
        var a = real / denominator; var b = imaginary / denominator;
        if (a * a + b * b < 1e-12) throw new FaceInputException("INVALID_LANDMARKS", "Degenerate face transform.");
        var matrix = new Mat(2, 3, MatType.CV_64FC1);
        matrix.Set(0, 0, a); matrix.Set(0, 1, -b); matrix.Set(0, 2, dx - a * sx + b * sy);
        matrix.Set(1, 0, b); matrix.Set(1, 1, a); matrix.Set(1, 2, dy - b * sx - a * sy);
        return matrix;
    }

    public Mat Feature(Mat aligned)
    {
        // SFace expects RGB 112x112, scale 1 and no mean subtraction (OpenCV reference pipeline).
        using var blob = CvDnn.BlobFromImage(aligned, 1, new Size(112, 112), Scalar.All(0), swapRB: true, crop: false);
        network.SetInput(blob);
        return network.Forward();
    }

    public void Dispose() => network.Dispose();
}
