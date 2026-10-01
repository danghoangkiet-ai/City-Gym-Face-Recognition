using CityGym.AI;
using System.Text.Json;
using OpenCvSharp;

var json = new JsonSerializerOptions { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
try
{
    if (args.Length == 3 && args[0] == "pipeline-test")
    {
        var checks = new List<string>();
        void Check(bool passed, string name) { if (!passed) throw new Exception(name); checks.Add(name); Console.Error.WriteLine("PASS " + name); }
        using var engine = new FaceEngine(args[1]);
        void Reject(byte[] bytes, string code)
        {
            try { engine.Extract(bytes); }
            catch (FaceInputException e) when (e.Code == code) { checks.Add(code); Console.Error.WriteLine("PASS " + code); return; }
            throw new Exception("Expected " + code);
        }
        Reject([1, 2, 3], "INVALID_IMAGE");
        using var blank = new Mat(320, 320, MatType.CV_8UC3, Scalar.Black);
        Reject(blank.ToBytes(".png"), "NO_FACE");
        var input = File.ReadAllBytes(args[2]);
        var feature = engine.Extract(input);
        Check(feature.Vector.Length == 128 && feature.Vector.All(float.IsFinite), "SFace: 128 finite values");
        Check(Math.Abs(feature.Vector.Sum(v => (double)v * v) - 1) < 1e-5, "L2 normalized");
        Check(FeatureMath.Serialize(feature.Vector).Length == 512, "512-byte serialization");
        using var photo = Cv2.ImDecode(input, ImreadModes.Color);
        using var sampleDetector = FaceDetectorYN.Create(Path.Combine(args[1], "face_detection_yunet_2023mar.onnx"), "", photo.Size(), 0.9f);
        using var detected = new Mat();
        sampleDetector.Detect(photo, detected);
        Check(detected.Rows == 1, "Fixture has one face at native resolution");
        var x = Math.Max(0, (int)detected.At<float>(0, 0) - 30);
        var y = Math.Max(0, (int)detected.At<float>(0, 1) - 30);
        var width = Math.Min(photo.Width - x, (int)detected.At<float>(0, 2) + 60);
        var height = Math.Min(photo.Height - y, (int)detected.At<float>(0, 3) + 60);
        using var crop = new Mat(photo, new Rect(x, y, width, height));
        using var pair = new Mat();
        Cv2.HConcat(new[] { crop, crop }, pair);
        Reject(pair.ToBytes(".png"), "MULTIPLE_FACES");
        using var rotation = Cv2.GetRotationMatrix2D(new Point2f(photo.Width / 2f, photo.Height / 2f), 15, 0.85);
        using var tilted = new Mat();
        Cv2.WarpAffine(photo, tilted, rotation, photo.Size());
        var tiltedFeature = engine.Extract(tilted.ToBytes(".png"));
        Check(tiltedFeature.Vector.Length == 128, "Tilted face: full pipeline completed");
        Point2d[] points = [new(0,0),new(10,0),new(5,5),new(2,9),new(8,9)];
        var expected = points.Select(p => new Point2d(1.2 * p.X - 0.4 * p.Y + 23, 0.4 * p.X + 1.2 * p.Y - 7)).ToArray();
        using var transform = SFaceExtractor.SimilarityTransform(points, expected);
        Check(points.Select((p, i) => Math.Abs(transform.At<double>(0,0)*p.X + transform.At<double>(0,1)*p.Y + transform.At<double>(0,2) - expected[i].X) + Math.Abs(transform.At<double>(1,0)*p.X + transform.At<double>(1,1)*p.Y + transform.At<double>(1,2) - expected[i].Y)).All(error => error < 1e-8), "Alignment: rotation, scale and translation recovered");
        Console.WriteLine(JsonSerializer.Serialize(new { passed = checks.Count, checks, detectionScore = feature.DetectionScore, dimension = feature.Vector.Length }, json));
        return 0;
    }
    if (args.Length == 1 && args[0] == "self-test")
    {
        var a = new float[128]; a[0] = 1;
        var b = new float[128]; b[1] = 1;
        var feature = new FaceFeature(FaceEngine.Model, FaceEngine.Pipeline, a, 1);
        var gallery = new[] { new GalleryEntry("member-1", feature) };
        void Check(bool value, string name) { if (!value) throw new Exception(name); }
        void Reject(Action action, string code)
        {
            try { action(); } catch (FaceInputException e) when (e.Code == code) { return; }
            throw new Exception("Expected " + code);
        }
        Check(FeatureMath.Identify(feature, gallery, 0.5).Found, "positive");
        Check(!FeatureMath.Identify(feature with { Vector = b }, gallery, 0.5).Found, "negative");
        Check(FeatureMath.Deserialize(FeatureMath.Serialize(a)).SequenceEqual(a), "binary roundtrip");
        Reject(() => FeatureMath.Normalize(new float[128]), "INVALID_FEATURE");
        Reject(() => FeatureMath.Normalize(new float[127]), "INVALID_FEATURE");
        var invalid = (float[])a.Clone(); invalid[0] = float.NaN;
        Reject(() => FeatureMath.Normalize(invalid), "INVALID_FEATURE");
        Reject(() => FeatureMath.Identify(feature, [], 0.5), "EMPTY_GALLERY");
        Reject(() => FeatureMath.Validate(feature with { Pipeline = "other" }), "INCOMPATIBLE_FEATURE");
        Console.WriteLine("8 feature checks passed. Native inference requires smoke-test or extract.");
        return 0;
    }
    if (args.Length == 2 && args[0] == "smoke-test")
    {
        using var engine = new FaceEngine(args[1]);
        using var blank = new OpenCvSharp.Mat(320, 320, OpenCvSharp.MatType.CV_8UC3, OpenCvSharp.Scalar.Black);
        try { engine.Extract(blank.ToBytes(".png")); }
        catch (FaceInputException e) when (e.Code == "NO_FACE")
        { Console.WriteLine("Models loaded; native detector returned NO_FACE for blank image."); return 0; }
        throw new Exception("Blank image unexpectedly detected a face.");
    }
    if (args.Length == 3 && args[0] == "extract")
    {
        using var engine = new FaceEngine(args[1]);
        Console.WriteLine(JsonSerializer.Serialize(engine.Extract(File.ReadAllBytes(args[2])), json));
        return 0;
    }
    if (args.Length == 5 && args[0] == "compare")
    {
        using var engine = new FaceEngine(args[1]);
        var reference = engine.Extract(File.ReadAllBytes(args[2]));
        var probe = engine.Extract(File.ReadAllBytes(args[3]));
        var threshold = double.Parse(args[4], System.Globalization.CultureInfo.InvariantCulture);
        Console.WriteLine(JsonSerializer.Serialize(FeatureMath.Identify(probe, [new("reference", reference)], threshold), json));
        return 0;
    }
    Console.Error.WriteLine("Usage: self-test | smoke-test <models> | pipeline-test <models> <single-face-image> | extract <models> <image> | compare <models> <reference> <probe> <threshold>");
    return 2;
}
catch (Exception e)
{
    Console.Error.WriteLine(JsonSerializer.Serialize(new { code = e is FaceInputException f ? f.Code : "ENGINE_ERROR", message = e.Message }, json));
    return 1;
}
