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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
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

    public byte[] exportExcel(UUID sessionId, String hostToken) {
        WorkshopSession session = sessionService.requireSession(sessionId);
        sessionService.assertHost(session, hostToken);
        try (XSSFWorkbook workbook = new XSSFWorkbook();
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet entries = workbook.createSheet("Entries");
            Row header = entries.createRow(0);
            header.createCell(0).setCellValue("Content");
            header.createCell(1).setCellValue("Step");
            header.createCell(2).setCellValue("Group");
            int r = 1;
            for (var e : entryRepository.findBySessionIdAndHiddenFalseOrderByCreatedAtAsc(sessionId)) {
                Row row = entries.createRow(r++);
                row.createCell(0).setCellValue(e.getContent());
                row.createCell(1).setCellValue(String.valueOf(e.getSessionStepId()));
                row.createCell(2).setCellValue(e.getGroupId() == null ? "" : String.valueOf(e.getGroupId()));
            }
            Sheet actions = workbook.createSheet("Actions");
            Row ah = actions.createRow(0);
            ah.createCell(0).setCellValue("Action");
            ah.createCell(1).setCellValue("Owner");
            ah.createCell(2).setCellValue("Due Date");
            int ar = 1;
            for (Map<String, Object> a : activityService.listActions(sessionId)) {
                Row row = actions.createRow(ar++);
                row.createCell(0).setCellValue(String.valueOf(a.get("action")));
                row.createCell(1).setCellValue(a.get("owner") == null ? "" : String.valueOf(a.get("owner")));
                row.createCell(2).setCellValue(a.get("dueDate") == null ? "" : String.valueOf(a.get("dueDate")));
            }
            Sheet summary = workbook.createSheet("Summary");
            Map<String, Object> sum = summaryService.latest(sessionId);
            summary.createRow(0).createCell(0).setCellValue("Insights");
            int sr = 1;
            Object insights = sum.get("insights");
            if (insights instanceof List<?> list) {
                for (Object i : list) {
                    summary.createRow(sr++).createCell(0).setCellValue(String.valueOf(i));
                }
            }
            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new com.bosch.workshop.common.ApiException("Excel export failed: " + e.getMessage());
        }
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
}
