using System.Buffers.Binary;

namespace CityGym.AI;

public static class FeatureMath
{
    public static float[] Normalize(float[] vector)
    {
        if (vector.Length != 128 || vector.Any(v => !float.IsFinite(v)))
            throw new FaceInputException("INVALID_FEATURE", "Expected 128 finite float values.");
        var norm = Math.Sqrt(vector.Sum(v => (double)v * v));
        if (norm <= 1e-12) throw new FaceInputException("INVALID_FEATURE", "Zero vector is not valid.");
        return vector.Select(v => (float)(v / norm)).ToArray();
    }

    public static void Validate(FaceFeature feature)
    {
        if (feature.Model != FaceEngine.Model || feature.Pipeline != FaceEngine.Pipeline)
            throw new FaceInputException("INCOMPATIBLE_FEATURE", "Model and pipeline must match.");
        Normalize(feature.Vector);
    }

    /// <summary>Caller supplies only active entries authorized for the requesting terminal.</summary>
    public static MatchResult Identify(FaceFeature probe, IEnumerable<GalleryEntry> authorizedGallery, double threshold)
    {
        if (!double.IsFinite(threshold) || threshold < -1 || threshold > 1)
            throw new ArgumentOutOfRangeException(nameof(threshold));
        Validate(probe);
        var normalized = Normalize(probe.Vector);
        string? bestId = null;
        var bestScore = double.NegativeInfinity;
        foreach (var entry in authorizedGallery)
        {
            Validate(entry.Feature);
            var candidate = Normalize(entry.Feature.Vector);
            var score = Math.Clamp(normalized.Select((v, i) => (double)v * candidate[i]).Sum(), -1, 1);
            if (score > bestScore) { bestScore = score; bestId = entry.FaceInfoId; }
        }
        if (bestId is null) throw new FaceInputException("EMPTY_GALLERY", "No authorized face embeddings.");
        var found = bestScore >= threshold;
        return new MatchResult(found, found ? bestId : null, bestScore);
    }

    public static byte[] Serialize(float[] vector)
    {
        var normalized = Normalize(vector);
        var bytes = new byte[512];
        for (var i = 0; i < 128; i++) BinaryPrimitives.WriteSingleLittleEndian(bytes.AsSpan(i * 4, 4), normalized[i]);
        return bytes;
    }

    public static float[] Deserialize(byte[] bytes)
    {
        if (bytes.Length != 512) throw new FaceInputException("INVALID_FEATURE", "Expected 512 bytes.");
        var vector = new float[128];
        for (var i = 0; i < 128; i++) vector[i] = BinaryPrimitives.ReadSingleLittleEndian(bytes.AsSpan(i * 4, 4));
        return Normalize(vector);
    }
}
