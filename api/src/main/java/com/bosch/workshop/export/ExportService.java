package com.bosch.workshop.export;

import com.bosch.workshop.activity.ActivityService;
import com.bosch.workshop.domain.WorkshopSession;
import com.bosch.workshop.repository.InputEntryRepository;
import com.bosch.workshop.session.SessionService;
import com.bosch.workshop.summary.SummaryService;
import com.lowagie.text.Document;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ExportService {
    private final SessionService sessionService;
    private final ActivityService activityService;
    private final InputEntryRepository entryRepository;
    private final SummaryService summaryService;

    public ExportService(
            SessionService sessionService,
            ActivityService activityService,
            InputEntryRepository entryRepository,
            SummaryService summaryService) {
        this.sessionService = sessionService;
        this.activityService = activityService;
        this.entryRepository = entryRepository;
        this.summaryService = summaryService;
    }

    /** Lightweight CSV export (avoids Apache POI on free-tier memory limits). */
    public byte[] exportExcel(UUID sessionId, String hostToken) {
        WorkshopSession session = sessionService.requireSession(sessionId);
        sessionService.assertHost(session, hostToken);
        StringBuilder csv = new StringBuilder();
        csv.append("Section,Field1,Field2,Field3\n");
        csv.append(csvRow("Session", session.getTitle(), session.getCode(), String.valueOf(session.getStatus())));
        for (var e : entryRepository.findBySessionIdAndHiddenFalseOrderByCreatedAtAsc(sessionId)) {
            csv.append(csvRow(
                    "Entry",
                    e.getContent(),
                    String.valueOf(e.getSessionStepId()),
                    e.getGroupId() == null ? "" : String.valueOf(e.getGroupId())));
        }
        for (Map<String, Object> a : activityService.listActions(sessionId)) {
            csv.append(csvRow(
                    "Action",
                    String.valueOf(a.get("action")),
                    a.get("owner") == null ? "" : String.valueOf(a.get("owner")),
                    a.get("dueDate") == null ? "" : String.valueOf(a.get("dueDate"))));
        }
        Map<String, Object> sum = summaryService.latest(sessionId);
        Object insights = sum.get("insights");
        if (insights instanceof List<?> list) {
            for (Object i : list) {
                csv.append(csvRow("Insight", String.valueOf(i), "", ""));
            }
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    public byte[] exportPdf(UUID sessionId, String hostToken) {
        WorkshopSession session = sessionService.requireSession(sessionId);
        sessionService.assertHost(session, hostToken);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document();
            PdfWriter.getInstance(document, out);
            document.open();
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16);
            Font body = FontFactory.getFont(FontFactory.HELVETICA, 11);
            document.add(new Paragraph("Workshop OS Report", titleFont));
            document.add(new Paragraph(session.getTitle() + " (" + session.getCode() + ")", body));
            document.add(new Paragraph(" ", body));
            document.add(new Paragraph("Entries", titleFont));
            for (var e : entryRepository.findBySessionIdAndHiddenFalseOrderByCreatedAtAsc(sessionId)) {
                document.add(new Paragraph("• " + e.getContent(), body));
            }
            document.add(new Paragraph(" ", body));
            document.add(new Paragraph("Actions", titleFont));
            for (Map<String, Object> a : activityService.listActions(sessionId)) {
                document.add(new Paragraph(
                        "• " + a.get("action") + " — " + a.get("owner") + " / " + a.get("dueDate"), body));
            }
            Map<String, Object> sum = summaryService.latest(sessionId);
            document.add(new Paragraph(" ", body));
            document.add(new Paragraph("AI Summary", titleFont));
            Object insights = sum.get("insights");
            if (insights instanceof List<?> list) {
                for (Object i : list) {
                    document.add(new Paragraph("• " + i, body));
                }
            }
            document.close();
            return out.toByteArray();
        } catch (Exception e) {
            throw new com.bosch.workshop.common.ApiException("PDF export failed: " + e.getMessage());
        }
    }

    private static String csvRow(String a, String b, String c, String d) {
        return quote(a) + "," + quote(b) + "," + quote(c) + "," + quote(d) + "\n";
    }

    private static String quote(String value) {
        String v = value == null ? "" : value.replace("\"", "\"\"");
        return "\"" + v + "\"";
    }
}
