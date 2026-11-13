package io.github.elvuel.mkpkit.java.server;

public record MacroRecord(
    String id,
    String name,
    String unique_id,
    String mkp_path,
    int start_point_x,
    int start_point_y,
    int screen_width,
    int screen_height,
    String os,
    int seconds,
    int milliseconds,
    String created_at
) {
}
