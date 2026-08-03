package com.bosch.workshop.export;

import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions/{sessionId}")
public class ExportController {
    private final ExportService exportService;

    public ExportController(ExportService exportService) {
        this.exportService = exportService;
    }

    @GetMapping("/export.xlsx")
    public ResponseEntity<byte[]> excel(
            @PathVariable UUID sessionId, @RequestHeader("X-Host-Token") String hostToken) {
        byte[] bytes = exportService.exportExcel(sessionId, hostToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"workshop-" + sessionId + ".xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }

    @GetMapping("/export.pdf")
    public ResponseEntity<byte[]> pdf(
            @PathVariable UUID sessionId, @RequestHeader("X-Host-Token") String hostToken) {
        byte[] bytes = exportService.exportPdf(sessionId, hostToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"workshop-" + sessionId + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(bytes);
    }
}
