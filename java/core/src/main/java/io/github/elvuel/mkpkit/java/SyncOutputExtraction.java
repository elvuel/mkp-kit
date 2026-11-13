package io.github.elvuel.mkpkit.java;

import java.util.ArrayList;
import java.util.List;

public final class SyncOutputExtraction {
    private SyncOutputExtraction() {
    }

    public static ExtractedSyncOutput extract(String buffer, String directive, String eofFlag) {
        int hitIndex = buffer.indexOf(directive);
        if (hitIndex < 0) {
            return new ExtractedSyncOutput(null, buffer);
        }
        String segment = buffer.substring(hitIndex);
        int outputCompletedIndex;
        if (DirectiveParsing.EOF_CLI.equals(eofFlag)) {
            outputCompletedIndex = segment.indexOf(DirectiveParsing.EOF_CLI);
        } else {
            List<Integer> candidates = new ArrayList<>();
            int eofIndex = segment.indexOf(DirectiveParsing.EOF_DEFAULT);
            int cliIndex = segment.indexOf(DirectiveParsing.EOF_CLI);
            if (eofIndex >= 0) {
                candidates.add(eofIndex);
            }
            if (cliIndex >= 0) {
                candidates.add(cliIndex);
            }
            outputCompletedIndex = candidates.stream().min(Integer::compareTo).orElse(-1);
        }
        if (outputCompletedIndex < 0) {
            return new ExtractedSyncOutput(null, buffer);
        }
        return new ExtractedSyncOutput(segment.substring(0, outputCompletedIndex), "");
    }

    public record ExtractedSyncOutput(String output, String remaining) {
    }
}
